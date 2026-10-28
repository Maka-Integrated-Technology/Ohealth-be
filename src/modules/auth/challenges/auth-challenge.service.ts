import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { AuthChallengePurpose } from './auth-challenge.entity';

const MAX_ATTEMPTS = 5;
const CHALLENGE_LIFETIME_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const INVALID_CHALLENGE = 'Invalid or expired authentication challenge.';

export interface IAuthChallengeIssued {
  challengeId: string;
  /** Sensitive: send only through an approved contact-delivery mechanism. */
  code: string;
  expiresAt: Date;
}

interface IChallengeRow {
  id: string;
  purpose: AuthChallengePurpose;
  subject_user_id: string;
  secret_hash: string;
  attempt_count: number;
  consumed_at: Date | null;
  expires_at: Date;
}

@Injectable()
export class AuthChallengeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * Internal only: do not return the secret to an HTTP client.
   * Public send and recovery endpoints are NOT wired in this foundation.
   */
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
    const pepper = this.getPepper();
    // The subject lock serializes even two simultaneous FIRST sends.
    const users: Array<{ id: string }> = await manager.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [subjectUserId],
    );
    if (users.length !== 1) {
      throw new BadRequestException(INVALID_CHALLENGE);
    }
    const latest: Array<{ issued_at: Date }> = await manager.query(
      `
      SELECT issued_at FROM auth_challenges
      WHERE subject_user_id = $1 AND purpose = $2
      ORDER BY issued_at DESC LIMIT 1
      `,
      [subjectUserId, purpose],
    );
    const now = new Date();
    if (
      latest.length > 0 &&
      now.getTime() - latest[0].issued_at.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Please wait before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const challengeId = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const digest = this.hashCode(pepper, challengeId, purpose, code);
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS);
    await manager.query(
      `
      UPDATE auth_challenges SET consumed_at = now()
      WHERE subject_user_id = $1 AND purpose = $2 AND consumed_at IS NULL
      `,
      [subjectUserId, purpose],
    );
    await manager.query(
      `
      INSERT INTO auth_challenges (
        id, purpose, subject_user_id, secret_hash, expires_at
      ) VALUES ($1, $2, $3, $4, $5)
      `,
      [challengeId, purpose, subjectUserId, digest, expiresAt],
    );
    return { challengeId, code, expiresAt };
  }

  /**
   * Consumes the challenge and changes protected state atomically.
   * Invalid attempts commit their counter before an error is returned.
   */
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
      if (!subject) {
        return { approved: false as const };
      }
      return {
        approved: true as const,
        value: await mutate(manager, subject),
      };
    });
    if (!result.approved) {
      throw new BadRequestException(INVALID_CHALLENGE);
    }
    return result.value;
  }

  /**
   * Lower-level primitive for producer-owned transactions. A failed attempt
   * returns null rather than throwing so its increment can be committed.
   * The caller must commit before turning null into a public error.
   */
  async consumeInTransaction(
    manager: EntityManager,
    challengeId: string,
    purpose: AuthChallengePurpose,
    code: string,
  ): Promise<string | null> {
    this.assertTransaction(manager);
    this.assertPurpose(purpose);
    const pepper = this.getPepper();
    if (
      typeof challengeId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        challengeId,
      ) ||
      typeof code !== 'string' ||
      code.length !== 6
    ) {
      return null;
    }
    // Keep the same lock order as issuance (subject user -> challenge).
    // Reading the immutable subject first avoids a resend/consume deadlock;
    // the challenge itself is still rechecked under FOR UPDATE below.
    const references: Array<{ subject_user_id: string }> = await manager.query(
      'SELECT subject_user_id FROM auth_challenges WHERE id = $1',
      [challengeId],
    );
    if (!references.length) return null;
    const subjects: Array<{ id: string }> = await manager.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [references[0].subject_user_id],
    );
    if (!subjects.length) return null;
    const rows: IChallengeRow[] = await manager.query(
      'SELECT * FROM auth_challenges WHERE id = $1 FOR UPDATE',
      [challengeId],
    );
    const challenge = rows[0];
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.consumed_at ||
      challenge.expires_at <= new Date() ||
      challenge.attempt_count >= MAX_ATTEMPTS
    ) {
      return null;
    }
    const candidate = this.hashCode(pepper, challengeId, purpose, code);
    const valid = timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(challenge.secret_hash, 'hex'),
    );
    if (!valid || !/^\d{6}$/.test(code)) {
      await manager.query(
        `
        UPDATE auth_challenges
        SET attempt_count = attempt_count + 1,
            consumed_at = CASE
              WHEN attempt_count + 1 >= $2 THEN now() ELSE NULL END
        WHERE id = $1
        `,
        [challengeId, MAX_ATTEMPTS],
      );
      return null;
    }
    await manager.query(
      'UPDATE auth_challenges SET consumed_at = now() WHERE id = $1',
      [challengeId],
    );
    return challenge.subject_user_id;
  }

  /** Validate the HMAC secret before accepting live authentication traffic. */
  assertConfigured(): void {
    this.getPepper();
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
