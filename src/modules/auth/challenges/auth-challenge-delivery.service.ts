import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { EmailTemplateID } from '../../../constants/email-constants';
import { EmailService } from '../../email/email.service';
import { User } from '../../user/entities/user.entity';

import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';

const MAX_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 90;
const SEND_TIMEOUT_MS = 30_000;
const COOLDOWN_SECONDS = 60;

interface IPendingDelivery {
  challenge_id: string;
  iv: string;
  ciphertext: string;
  tag: string;
  purpose: AuthChallengePurpose;
  expires_at: Date;
  consumed_at: Date | null;
  email: string;
  first_name: string;
  attempts: number;
}

/**
 * Internal #75 delivery boundary. A producer must persist the challenge,
 * encrypted recovery envelope, and any parent identity/outbox changes using
 * the SAME transaction. No secret or account address enters outbox JSON.
 *
 * Delivery is at-least-once: provider acceptance followed by a DB crash can
 * result in a repeat email. Consumers must never treat queuing as "sent".
 */
@Injectable()
export class AuthChallengeDeliveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly challenges: AuthChallengeService,
    private readonly email: EmailService,
  ) {}

  /** Validate the AES-GCM secret before any public or worker action. */
  assertConfigured(): void {
    this.getEncryptionKey();
  }

  /** Live producers are disabled if no healthy dispatcher has checked in. */
  async assertWorkerReady(manager?: EntityManager): Promise<void> {
    const query = manager ?? this.dataSource;
    const rows: Array<{ id: string }> = await query.query(
      'SELECT id FROM auth_challenge_worker_heartbeat ' +
        "WHERE id = 'delivery' AND last_seen_at > now() - interval '30 seconds' " +
        'AND oldest_pending_seconds < 120 AND expired_leases = 0',
    );
    if (!rows.length) {
      throw new Error('Auth challenge delivery worker is not healthy.');
    }
  }

  async queueInTransaction(
    manager: EntityManager,
    user: Pick<User, 'id'>,
    purpose: AuthChallengePurpose,
  ): Promise<{
    challengeId: string;
    resendAfterSeconds: number;
    expiresInSeconds: number;
  }> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('Challenge delivery requires a database transaction.');
    }
    // Validate deployment readiness BEFORE issuing or superseding a code.
    const key = this.getEncryptionKey();
    if (this.config.get<string>('AUTH_CHALLENGE_FLOWS_ENABLED') === 'true') {
      await this.assertWorkerReady(manager);
    }
    const challenge = await this.challenges.issueInTransaction(
      manager,
      user.id,
      purpose,
    );
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(this.additionalData(challenge.challengeId, purpose));
    const ciphertext = Buffer.concat([
      cipher.update(challenge.code, 'utf8'),
      cipher.final(),
    ]);
    await manager.query(
      'INSERT INTO auth_challenge_deliveries ' +
        '(challenge_id, iv, ciphertext, tag) VALUES ($1, $2, $3, $4)',
      [
        challenge.challengeId,
        iv.toString('hex'),
        ciphertext.toString('hex'),
        cipher.getAuthTag().toString('hex'),
      ],
    );
    return {
      challengeId: challenge.challengeId,
      resendAfterSeconds: COOLDOWN_SECONDS,
      expiresInSeconds: Math.max(
        1,
        Math.ceil((challenge.expiresAt.getTime() - Date.now()) / 1000),
      ),
    };
  }

  /**
   * Claim-and-lease is committed BEFORE provider I/O, which must never
   * occupy a PostgreSQL connection or lock. Each attempt has a fencing token
   * and leases can be reclaimed after a worker crash.
   *
   * Provider acceptance is at-least-once, not exactly-once. A timeout can
   * race with provider delivery; never report an unpersisted acceptance.
   */
  async dispatchBatch(
    batchSize = 5,
  ): Promise<{ accepted: number; retried: number; discarded: number }> {
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > MAX_BATCH_SIZE
    ) {
      throw new BadRequestException('Invalid challenge delivery batch size.');
    }
    const key = this.getEncryptionKey();
    const counts = { accepted: 0, retried: 0, discarded: 0 };
    for (let index = 0; index < batchSize; index++) {
      const claim = await this.claim();
      if (!claim) break;
      let outcome: 'accepted' | 'retried' | 'discarded';
      if (
        claim.terminal ||
        claim.consumed_at ||
        new Date(claim.expires_at) <= new Date()
      ) {
        outcome = 'discarded';
      } else {
        try {
          const decipher = createDecipheriv(
            'aes-256-gcm',
            key,
            Buffer.from(claim.iv, 'hex'),
          );
          decipher.setAAD(
            this.additionalData(claim.challenge_id, claim.purpose),
          );
          decipher.setAuthTag(Buffer.from(claim.tag, 'hex'));
          const code = Buffer.concat([
            decipher.update(Buffer.from(claim.ciphertext, 'hex')),
            decipher.final(),
          ]).toString('utf8');
          if (!/^\d{6}$/.test(code)) {
            throw new Error('Invalid challenge envelope.');
          }
          const fromAddress = this.config.get<string>('mail.from.address');
          if (!fromAddress) throw new Error('Email sender not configured.');
          const fromName = this.config.get<string>('mail.from.name');
          const appName = this.config.get<string>('app.name') || 'OHealth';
          const recovery =
            claim.purpose === AuthChallengePurpose.PASSWORD_RECOVERY;
          const frontEndUrl = this.config.get<string>('frontend.url');

          // No active DB transaction while waiting on SMTP/Resend.
          await this.sendWithTimeout({
            from: { email: fromAddress, name: fromName },
            to: [{ email: claim.email, name: claim.first_name }],
            subject: recovery
              ? 'Reset your ' + appName + ' password'
              : 'Verify your ' + appName + ' account',
            templateNameID: recovery
              ? EmailTemplateID.OTP
              : EmailTemplateID.VERIFICATION_CODE,
            templateData: recovery
              ? {
                  name: claim.first_name,
                  app_name: appName,
                  otp: code,
                  otp_digits: code.split(''),
                  challenge_id: claim.challenge_id,
                  reset_url: frontEndUrl
                    ? frontEndUrl +
                      '/reset-password?challenge_id=' +
                      encodeURIComponent(claim.challenge_id)
                    : undefined,
                  expiry_minutes: 10,
                }
              : {
                  name: claim.first_name,
                  app_name: appName,
                  code,
                  challenge_id: claim.challenge_id,
                  verification_url: frontEndUrl
                    ? frontEndUrl +
                      '/verify-email?challenge_id=' +
                      encodeURIComponent(claim.challenge_id)
                    : undefined,
                  expiry_minutes: 10,
                },
          });
          outcome = 'accepted';
        } catch {
          // Redact recipient, code, transport and provider error details.
          outcome =
            Number(claim.attempts) < MAX_ATTEMPTS ? 'retried' : 'discarded';
        }
      }
      // A stale worker cannot finalize a lease reclaimed by another worker.
      if (await this.finalize(claim.challenge_id, claim.lease_token, outcome)) {
        counts[outcome]++;
      }
    }
    return counts;
  }

  private async claim(): Promise<
    (IPendingDelivery & { lease_token: string; terminal: boolean }) | null
  > {
    return this.dataSource.transaction(async (manager) => {
      const rows: IPendingDelivery[] = await manager.query(
        'SELECT d.challenge_id, d.iv, d.ciphertext, d.tag, d.attempts, ' +
          'c.purpose, c.expires_at, c.consumed_at, u.email, u.first_name ' +
          'FROM auth_challenge_deliveries d ' +
          'JOIN auth_challenges c ON c.id = d.challenge_id ' +
          'JOIN users u ON u.id = c.subject_user_id ' +
          'WHERE (d.status = $1 AND d.available_at <= now()) ' +
          'OR (d.status = $2 AND d.lease_expires_at <= now()) ' +
          'ORDER BY d.available_at, d.created_at LIMIT 1 ' +
          'FOR UPDATE OF d SKIP LOCKED',
        ['pending', 'processing'],
      );
      const delivery = rows[0];
      if (!delivery) return null;
      const leaseToken = randomUUID();
      await manager.query(
        'UPDATE auth_challenge_deliveries ' +
          "SET status = 'processing', lease_token = $2, " +
          "lease_expires_at = now() + ($3::integer * interval '1 second'), " +
          'attempts = LEAST(attempts + 1, $4) WHERE challenge_id = $1',
        [delivery.challenge_id, leaseToken, LEASE_SECONDS, MAX_ATTEMPTS],
      );
      return {
        ...delivery,
        attempts: Number(delivery.attempts) + 1,
        lease_token: leaseToken,
        // A worker that died during its last allowed attempt must not
        // restart unlimited sends each time its expired lease is reclaimed.
        terminal: Number(delivery.attempts) >= MAX_ATTEMPTS,
      };
    });
  }

  private async finalize(
    challengeId: string,
    leaseToken: string,
    outcome: 'accepted' | 'retried' | 'discarded',
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const rows: Array<{ challenge_id: string }> = await manager.query(
        'UPDATE auth_challenge_deliveries SET ' +
          "status = CASE WHEN $3 = 'retried' THEN 'pending' ELSE $3 END, " +
          'lease_token = NULL, lease_expires_at = NULL, ' +
          "available_at = CASE WHEN $3 = 'retried' " +
          "THEN now() + interval '120 seconds' ELSE available_at END, " +
          "iv = CASE WHEN $3 = 'retried' THEN iv ELSE NULL END, " +
          "ciphertext = CASE WHEN $3 = 'retried' THEN ciphertext ELSE NULL END, " +
          "tag = CASE WHEN $3 = 'retried' THEN tag ELSE NULL END, " +
          "accepted_at = CASE WHEN $3 = 'accepted' THEN now() ELSE NULL END " +
          "WHERE challenge_id = $1 AND lease_token = $2 AND status = 'processing' " +
          'RETURNING challenge_id',
        [challengeId, leaseToken, outcome],
      );
      return rows.length === 1;
    });
  }

  private async sendWithTimeout(
    options: Parameters<EmailService['sendMail']>[0],
  ): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.email.sendMail(options),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Challenge delivery timeout.')),
            SEND_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private additionalData(id: string, purpose: AuthChallengePurpose): Buffer {
    return Buffer.from('ohealth:challenge-delivery:v1:' + id + ':' + purpose);
  }

  private getEncryptionKey(): Buffer {
    const secret = this.config.get<string>('AUTH_CHALLENGE_DELIVERY_KEY');
    if (typeof secret !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
      throw new Error(
        'AUTH_CHALLENGE_DELIVERY_KEY must be a base64-encoded 32-byte key.',
      );
    }
    const key = Buffer.from(secret, 'base64');
    if (key.length !== 32 || key.toString('base64') !== secret) {
      throw new Error('Invalid challenge delivery key.');
    }
    return key;
  }
}
