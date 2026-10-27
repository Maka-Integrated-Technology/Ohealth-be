import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
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
    // Validate key BEFORE issuing any challenge or superseding older ones.
    const key = this.getEncryptionKey();
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
   * Operator/worker entry point. A short, bounded batch only; no HTTP route or
   * automatic scheduler is enabled. SKIP LOCKED coordinates worker instances.
   * A provider "accepted" result is written only after sendMail resolves.
   */
  async dispatchBatch(
    batchSize = 5,
  ): Promise<{ accepted: number; retried: number; discarded: number }> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
      throw new BadRequestException('Invalid challenge delivery batch size.');
    }
    const key = this.getEncryptionKey();
    const counts = { accepted: 0, retried: 0, discarded: 0 };
    for (let index = 0; index < batchSize; index++) {
      const outcome = await this.dataSource.transaction(async (manager) => {
        const rows: IPendingDelivery[] = await manager.query(
          'SELECT d.challenge_id, d.iv, d.ciphertext, d.tag, d.attempts, ' +
            'c.purpose, c.expires_at, c.consumed_at, u.email, u.first_name ' +
            'FROM auth_challenge_deliveries d ' +
            'JOIN auth_challenges c ON c.id = d.challenge_id ' +
            'JOIN users u ON u.id = c.subject_user_id ' +
            'WHERE d.status = $1 AND d.available_at <= now() ' +
            'ORDER BY d.available_at, d.created_at LIMIT 1 ' +
            'FOR UPDATE OF d SKIP LOCKED',
          ['pending'],
        );
        const delivery = rows[0];
        if (!delivery) return null;
        if (delivery.consumed_at || new Date(delivery.expires_at) <= new Date()) {
          await this.purge(manager, delivery.challenge_id, 'discarded');
          return 'discarded';
        }

        try {
          const decipher = createDecipheriv(
            'aes-256-gcm',
            key,
            Buffer.from(delivery.iv, 'hex'),
          );
          decipher.setAAD(
            this.additionalData(delivery.challenge_id, delivery.purpose),
          );
          decipher.setAuthTag(Buffer.from(delivery.tag, 'hex'));
          const code = Buffer.concat([
            decipher.update(Buffer.from(delivery.ciphertext, 'hex')),
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
            delivery.purpose === AuthChallengePurpose.PASSWORD_RECOVERY;
          const frontEndUrl = this.config.get<string>('frontend.url');
          await this.email.sendMail({
            from: { email: fromAddress, name: fromName },
            to: [{ email: delivery.email, name: delivery.first_name }],
            subject: recovery
              ? 'Reset your ' + appName + ' password'
              : 'Verify your ' + appName + ' account',
            templateNameID: recovery
              ? EmailTemplateID.OTP
              : EmailTemplateID.VERIFICATION_CODE,
            templateData: recovery
              ? {
                  name: delivery.first_name,
                  app_name: appName,
                  otp: code,
                  otp_digits: code.split(''),
                  reset_url: frontEndUrl
                    ? frontEndUrl + '/reset-password?challenge_id=' +
                      encodeURIComponent(delivery.challenge_id) +
                      '&code=' + encodeURIComponent(code)
                    : undefined,
                  expiry_minutes: 10,
                }
              : {
                  name: delivery.first_name,
                  app_name: appName,
                  code,
                  expiry_minutes: 10,
                },
          });
          await this.purge(manager, delivery.challenge_id, 'accepted');
          return 'accepted';
        } catch {
          // A wrong encryption key, corrupted envelope, missing mail config or
          // provider outage must not reveal secrets in logs or a fake success.
          const retryAllowed =
            Number(delivery.attempts) + 1 < MAX_ATTEMPTS;
          await manager.query(
            'UPDATE auth_challenge_deliveries SET ' +
              'attempts = attempts + 1, ' +
              'status = CASE WHEN $2 THEN \'pending\' ELSE \'discarded\' END, ' +
              'available_at = now() + interval \'120 seconds\', ' +
              'iv = CASE WHEN $2 THEN iv ELSE NULL END, ' +
              'ciphertext = CASE WHEN $2 THEN ciphertext ELSE NULL END, ' +
              'tag = CASE WHEN $2 THEN tag ELSE NULL END ' +
              'WHERE challenge_id = $1',
            [delivery.challenge_id, retryAllowed],
          );
          return retryAllowed ? 'retried' : 'discarded';
        }
      });
      if (!outcome) break;
      if (outcome === 'accepted') counts.accepted++;
      if (outcome === 'retried') counts.retried++;
      if (outcome === 'discarded') counts.discarded++;
    }
    return counts;
  }

  private async purge(
    manager: EntityManager,
    challengeId: string,
    status: 'accepted' | 'discarded',
  ): Promise<void> {
    await manager.query(
      'UPDATE auth_challenge_deliveries SET status = $2, ' +
        'iv = NULL, ciphertext = NULL, tag = NULL, ' +
        'accepted_at = CASE WHEN $2 = \'accepted\' THEN now() ELSE NULL END ' +
        'WHERE challenge_id = $1',
      [challengeId, status],
    );
  }

  private additionalData(id: string, purpose: AuthChallengePurpose): Buffer {
    return Buffer.from('ohealth:challenge-delivery:v1:' + id + ':' + purpose);
  }

  private getEncryptionKey(): Buffer {
    const secret = this.config.get<string>('AUTH_CHALLENGE_DELIVERY_KEY');
    if (
      typeof secret !== 'string' ||
      !/^[A-Za-z0-9+/]{43}=$/.test(secret)
    ) {
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
