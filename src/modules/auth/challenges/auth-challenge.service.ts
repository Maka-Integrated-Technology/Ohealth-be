import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import {
  AuthChallengePurpose,
  AuthChallengeTerminalReason,
} from './auth-challenge.entity';
import {
  AuthChallengeErrorCode,
  AuthChallengeException,
} from './auth-challenge.error';

const MAX_ATTEMPTS = 5;
const MAX_REPLACEMENTS = 5;
const CHALLENGE_LIFETIME_MS = 10 * 60_000;
const FLOW_LIFETIME_MS = 30 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const INVALID_CHALLENGE = 'Invalid authentication challenge.';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IAuthChallengeIssued {
  challengeId: string;
  /** Sensitive: send only through an approved contact-delivery mechanism. */
  code: string;
  expiresAt: Date;
  lineageId: string;
  replacementCount: number;
  flowExpiresAt: Date;
}

export interface IAuthChallengeContinuation {
  challengeId: string;
  expiresAt: Date;
  resendAfterSeconds: number;
  created: boolean;
  code?: string;
}

interface IChallengeRow {
  id: string;
  purpose: AuthChallengePurpose;
  subject_user_id: string;
  secret_hash: string;
  attempt_count: number;
  consumed_at: Date | null;
  expires_at: Date;
  issued_at: Date;
  lineage_id: string;
  replaced_by_challenge_id: string | null;
  terminal_reason: AuthChallengeTerminalReason | null;
  replacement_count: number;
  flow_expires_at: Date;
}

@Injectable()
export class AuthChallengeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  issueForUser(
    subjectUserId: string,
    purpose: AuthChallengePurpose,
  ): Promise<IAuthChallengeIssued> {
    return this.dataSource.transaction((manager) =>
      this.issueInTransaction(manager, subjectUserId, purpose),
    );
  }

  async issueInTransaction(
    manager: EntityManager,
    subjectUserId: string,
    purpose: AuthChallengePurpose,
  ): Promise<IAuthChallengeIssued> {
    this.assertTransaction(manager);
    this.assertPurpose(purpose);
    await this.lockSubject(manager, subjectUserId);
    const latest: Array<{ issued_at: Date }> = await manager.query(
      `SELECT issued_at FROM auth_challenges
       WHERE subject_user_id = $1 AND purpose = $2
       ORDER BY issued_at DESC LIMIT 1`,
      [subjectUserId, purpose],
    );
    const now = new Date();
    if (latest.length) {
      const waitMs =
        RESEND_COOLDOWN_MS -
        (now.getTime() - new Date(latest[0].issued_at).getTime());
      if (waitMs > 0) {
        throw new AuthChallengeException(
          AuthChallengeErrorCode.COOLDOWN,
          HttpStatus.TOO_MANY_REQUESTS,
          waitMs / 1000,
        );
      }
    }
    await manager.query(
      `UPDATE auth_challenges
       SET consumed_at = COALESCE(consumed_at, now()),
           terminal_reason = COALESCE(terminal_reason, $3)
       WHERE subject_user_id = $1 AND purpose = $2 AND terminal_reason IS NULL`,
      [
        subjectUserId,
        purpose,
        AuthChallengeTerminalReason.ADMINISTRATIVELY_REVOKED,
      ],
    );
    const challengeId = randomUUID();
    const flowExpiresAt = new Date(now.getTime() + FLOW_LIFETIME_MS);
    return this.insertChallenge(manager, {
      challengeId,
      lineageId: challengeId,
      subjectUserId,
      purpose,
      replacementCount: 0,
      flowExpiresAt,
      now,
    });
  }

  async replaceInTransaction(
    manager: EntityManager,
    challengeId: string,
    purpose: AuthChallengePurpose,
  ): Promise<IAuthChallengeContinuation> {
    this.assertTransaction(manager);
    this.assertPurpose(purpose);
    if (!UUID_PATTERN.test(challengeId)) this.throwInvalid();
    const references: Array<{ subject_user_id: string }> = await manager.query(
      'SELECT subject_user_id FROM auth_challenges WHERE id = $1 AND purpose = $2',
      [challengeId, purpose],
    );
    if (!references.length) this.throwInvalid();
    await this.lockSubject(manager, references[0].subject_user_id);
    const rows: IChallengeRow[] = await manager.query(
      'SELECT * FROM auth_challenges WHERE id = $1 AND purpose = $2 FOR UPDATE',
      [challengeId, purpose],
    );
    const requested = rows[0];
    if (!requested) this.throwInvalid();

    let authoritative = requested;
    for (let depth = 0; authoritative.replaced_by_challenge_id; depth++) {
      if (depth > MAX_REPLACEMENTS) this.throwInvalid();
      const replacements: IChallengeRow[] = await manager.query(
        'SELECT * FROM auth_challenges WHERE id = $1 AND lineage_id = $2',
        [authoritative.replaced_by_challenge_id, requested.lineage_id],
      );
      if (!replacements.length) this.throwInvalid();
      authoritative = replacements[0];
    }
    if (authoritative.id !== requested.id) {
      if (!authoritative.terminal_reason) {
        return this.toContinuation(authoritative, false);
      }
      throw this.exceptionForTerminal(authoritative.terminal_reason);
    }
    this.assertReplaceable(requested);
    const now = new Date();
    const waitMs =
      RESEND_COOLDOWN_MS -
      (now.getTime() - new Date(requested.issued_at).getTime());
    if (waitMs > 0) {
      throw new AuthChallengeException(
        AuthChallengeErrorCode.COOLDOWN,
        HttpStatus.TOO_MANY_REQUESTS,
        waitMs / 1000,
      );
    }
    if (requested.replacement_count >= MAX_REPLACEMENTS) {
      throw new AuthChallengeException(
        AuthChallengeErrorCode.RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
        Math.max(
          1,
          (new Date(requested.flow_expires_at).getTime() - now.getTime()) /
            1000,
        ),
      );
    }

    const nextId = randomUUID();
    await manager.query(
      `UPDATE auth_challenges
       SET consumed_at = now(), terminal_reason = $2
       WHERE id = $1`,
      [requested.id, AuthChallengeTerminalReason.SUPERSEDED],
    );
    const issued = await this.insertChallenge(manager, {
      challengeId: nextId,
      lineageId: requested.lineage_id,
      subjectUserId: requested.subject_user_id,
      purpose,
      replacementCount: requested.replacement_count + 1,
      flowExpiresAt: new Date(requested.flow_expires_at),
      now,
    });
    await manager.query(
      'UPDATE auth_challenges SET replaced_by_challenge_id = $2 WHERE id = $1',
      [requested.id, nextId],
    );
    return {
      challengeId: issued.challengeId,
      expiresAt: issued.expiresAt,
      resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      created: true,
      code: issued.code,
    };
  }

  async consumeWithMutation<T>(
    id: string,
    purpose: AuthChallengePurpose,
    code: string,
    mutate: (manager: EntityManager, subjectUserId: string) => Promise<T>,
  ): Promise<T> {
    const result = await this.dataSource.transaction(async (manager) => {
      const subject = await this.consumeInTransaction(
        manager,
        id,
        purpose,
        code,
      );
      if (!subject) return { approved: false as const };
      return { approved: true as const, value: await mutate(manager, subject) };
    });
    if (!result.approved) await this.throwConsumptionFailure(id, purpose);
    return result.value;
  }

  async consumeInTransaction(
    manager: EntityManager,
    challengeId: string,
    purpose: AuthChallengePurpose,
    code: string,
  ): Promise<string | null> {
    this.assertTransaction(manager);
    this.assertPurpose(purpose);
    if (
      typeof challengeId !== 'string' ||
      !UUID_PATTERN.test(challengeId) ||
      typeof code !== 'string' ||
      code.length !== 6
    )
      return null;
    const references: Array<{ subject_user_id: string }> = await manager.query(
      'SELECT subject_user_id FROM auth_challenges WHERE id = $1',
      [challengeId],
    );
    if (!references.length) return null;
    await this.lockSubject(manager, references[0].subject_user_id, false);
    const rows: IChallengeRow[] = await manager.query(
      'SELECT * FROM auth_challenges WHERE id = $1 FOR UPDATE',
      [challengeId],
    );
    const challenge = rows[0];
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.terminal_reason ||
      challenge.consumed_at ||
      new Date(challenge.expires_at) <= new Date() ||
      challenge.attempt_count >= MAX_ATTEMPTS
    )
      return null;
    const candidate = this.hashCode(
      this.getPepper(),
      challengeId,
      purpose,
      code,
    );
    const valid = timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(challenge.secret_hash, 'hex'),
    );
    if (!valid || !/^\d{6}$/.test(code)) {
      await manager.query(
        `UPDATE auth_challenges
         SET attempt_count = attempt_count + 1,
             consumed_at = CASE WHEN attempt_count + 1 >= $2 THEN now() ELSE NULL END,
             terminal_reason = CASE WHEN attempt_count + 1 >= $2 THEN $3 ELSE NULL END
         WHERE id = $1`,
        [
          challengeId,
          MAX_ATTEMPTS,
          AuthChallengeTerminalReason.ATTEMPTS_EXHAUSTED,
        ],
      );
      return null;
    }
    await manager.query(
      'UPDATE auth_challenges SET consumed_at = now(), terminal_reason = $2 WHERE id = $1',
      [challengeId, AuthChallengeTerminalReason.VERIFIED],
    );
    return challenge.subject_user_id;
  }

  assertConfigured(): void {
    this.getPepper();
  }

  private async insertChallenge(
    manager: EntityManager,
    input: {
      challengeId: string;
      lineageId: string;
      subjectUserId: string;
      purpose: AuthChallengePurpose;
      replacementCount: number;
      flowExpiresAt: Date;
      now: Date;
    },
  ): Promise<IAuthChallengeIssued> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const digest = this.hashCode(
      this.getPepper(),
      input.challengeId,
      input.purpose,
      code,
    );
    const expiresAt = new Date(
      Math.min(
        input.now.getTime() + CHALLENGE_LIFETIME_MS,
        input.flowExpiresAt.getTime(),
      ),
    );
    await manager.query(
      `INSERT INTO auth_challenges (
         id, purpose, subject_user_id, secret_hash, expires_at,
         lineage_id, replacement_count, flow_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.challengeId,
        input.purpose,
        input.subjectUserId,
        digest,
        expiresAt,
        input.lineageId,
        input.replacementCount,
        input.flowExpiresAt,
      ],
    );
    return {
      challengeId: input.challengeId,
      code,
      expiresAt,
      lineageId: input.lineageId,
      replacementCount: input.replacementCount,
      flowExpiresAt: input.flowExpiresAt,
    };
  }

  private async lockSubject(
    manager: EntityManager,
    subjectUserId: string,
    rejectMissing = true,
  ): Promise<void> {
    const users: Array<{ id: string }> = await manager.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [subjectUserId],
    );
    if (!users.length && rejectMissing) {
      throw new BadRequestException(INVALID_CHALLENGE);
    }
  }

  private assertReplaceable(challenge: IChallengeRow): void {
    const now = new Date();
    if (challenge.terminal_reason) {
      throw this.exceptionForTerminal(challenge.terminal_reason);
    }
    if (
      new Date(challenge.expires_at) <= now ||
      new Date(challenge.flow_expires_at) <= now
    ) {
      throw new AuthChallengeException(
        AuthChallengeErrorCode.EXPIRED,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private toContinuation(
    challenge: IChallengeRow,
    created: boolean,
  ): IAuthChallengeContinuation {
    return {
      challengeId: challenge.id,
      expiresAt: new Date(challenge.expires_at),
      resendAfterSeconds: Math.max(
        0,
        Math.ceil(
          (RESEND_COOLDOWN_MS -
            (Date.now() - new Date(challenge.issued_at).getTime())) /
            1000,
        ),
      ),
      created,
    };
  }

  private async throwConsumptionFailure(
    id: string,
    purpose: AuthChallengePurpose,
  ): Promise<never> {
    if (!UUID_PATTERN.test(id)) this.throwInvalid();
    const rows: IChallengeRow[] = await this.dataSource.query(
      'SELECT * FROM auth_challenges WHERE id = $1 AND purpose = $2',
      [id, purpose],
    );
    const challenge = rows[0];
    if (!challenge) this.throwInvalid();
    if (challenge.terminal_reason) {
      throw this.exceptionForTerminal(challenge.terminal_reason);
    }
    if (new Date(challenge.expires_at) <= new Date()) {
      throw new AuthChallengeException(
        AuthChallengeErrorCode.EXPIRED,
        HttpStatus.BAD_REQUEST,
      );
    }
    throw new AuthChallengeException(
      AuthChallengeErrorCode.CODE_INVALID,
      HttpStatus.BAD_REQUEST,
    );
  }

  private exceptionForTerminal(
    reason: AuthChallengeTerminalReason,
  ): AuthChallengeException {
    const code =
      reason === AuthChallengeTerminalReason.SUPERSEDED
        ? AuthChallengeErrorCode.SUPERSEDED
        : reason === AuthChallengeTerminalReason.ATTEMPTS_EXHAUSTED
          ? AuthChallengeErrorCode.ATTEMPTS_EXHAUSTED
          : AuthChallengeErrorCode.CONSUMED;
    return new AuthChallengeException(code, HttpStatus.BAD_REQUEST);
  }

  private throwInvalid(): never {
    throw new AuthChallengeException(
      AuthChallengeErrorCode.INVALID,
      HttpStatus.BAD_REQUEST,
    );
  }

  private getPepper(): string {
    const value = this.config.get<string>('AUTH_CHALLENGE_PEPPER');
    if (!value || Buffer.byteLength(value, 'utf8') < 32) {
      throw new Error(
        'AUTH_CHALLENGE_PEPPER must be set to at least 32 random bytes.',
      );
    }
    return value;
  }

  private hashCode(
    pepper: string,
    id: string,
    purpose: AuthChallengePurpose,
    code: string,
  ): string {
    return createHmac('sha256', pepper)
      .update('ohealth:auth-challenge:v1:', 'utf8')
      .update(id, 'ascii')
      .update(':', 'ascii')
      .update(purpose, 'ascii')
      .update(':', 'ascii')
      .update(code, 'utf8')
      .digest('hex');
  }

  private assertTransaction(manager: EntityManager): void {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error(
        'Authentication challenges require an active transaction.',
      );
    }
  }

  private assertPurpose(purpose: AuthChallengePurpose): void {
    if (!Object.values(AuthChallengePurpose).includes(purpose)) {
      throw new BadRequestException(INVALID_CHALLENGE);
    }
  }
}
