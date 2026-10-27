import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { LegalDocumentType } from '../../identity/enums/legal-document-type.enum';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../platform-events/enums/outbox-event-status.enum';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { RegistrationPendingResponseDto } from '../contracts/auth-contract-response.dto';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';

import {
  IRegistrationLegalVersions,
  maskRegistrationEmail,
  normalizeRegistrationInput,
} from './registration-input.util';

export interface IRegistrationChallengeReceipt {
  challengeId: string;
  resendAfterSeconds: number;
  expiresInSeconds: number;
}

/**
 * Issue #75's future implementation must create a purpose-bound challenge and
 * its recoverable encrypted delivery envelope using this SAME manager.
 * Throwing aborts identity creation, legal acceptance, membership and outbox.
 */
export type IRegistrationChallengeWriter = (
  manager: EntityManager,
  user: User,
) => Promise<IRegistrationChallengeReceipt>;

/**
 * Internal-only persistence foundation for issue #78. Deliberately no public
 * route is wired until issue #75 supplies the durable challenge writer.
 */
@Injectable()
export class RegistrationRecordsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwords: PasswordCredentialsService,
    private readonly config: ConfigService,
  ) {}

  async registerPending(
    dto: RegisterAccountDto,
    writeChallenge: IRegistrationChallengeWriter,
    idempotencyKey?: string,
  ): Promise<RegistrationPendingResponseDto> {
    if (typeof writeChallenge !== 'function') {
      throw new Error('A transactional durable challenge writer is required.');
    }
    const legalVersions: IRegistrationLegalVersions = {
      terms: this.config.get<string>('REGISTRATION_TERMS_VERSION') ?? '',
      privacy: this.config.get<string>('REGISTRATION_PRIVACY_VERSION') ?? '',
    };
    const input = normalizeRegistrationInput(dto, legalVersions);
    const retry =
      idempotencyKey !== undefined
        ? this.prepareIdempotency(idempotencyKey, dto.password, input)
        : null;
    // Use the centralized #76 policy, never a second password implementation.
    const hashedPassword = await this.passwords.hashNewPassword(dto.password);
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (retry) {
          // Acquire a transaction-scoped mutex before looking for the retry.
          // A collision on the advisory-lock hash only serializes unrelated
          // requests; the full HMAC key is checked below for identity.
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [retry.keyHash],
          );
          const previous: Array<{
            request_fingerprint: string;
            challenge_id: string;
            user_email: string;
            account_status: string;
            challenge_expires_at: Date;
            resend_after_at: Date;
          }> = await manager.query(
            `SELECT ra.request_fingerprint, ra.challenge_id,
                    u.email AS user_email, u.account_status,
                    ra.challenge_expires_at, ra.resend_after_at
             FROM registration_attempts ra
             JOIN users u ON u.id = ra.user_id
             WHERE ra.request_key_hash = $1 FOR UPDATE OF ra`,
            [retry.keyHash],
          );
          if (previous.length) {
            const attempt = previous[0];
            if (
              !this.matchesFingerprint(
                retry.fingerprint,
                attempt.request_fingerprint,
              ) ||
              attempt.account_status !== AccountStatus.PENDING_VERIFICATION ||
              new Date(attempt.challenge_expires_at).getTime() <= Date.now()
            ) {
              // Once expired, the existing resend/recovery flow must be used.
              // Reissuing here could silently strand the old challenge.
              throw new ConflictException('Registration retry is unavailable.');
            }
            const now = Date.now();
            return {
              message: 'Verification queued',
              challenge_id: attempt.challenge_id,
              delivery_target: maskRegistrationEmail(attempt.user_email),
              resend_after_seconds: Math.max(
                0,
                Math.ceil(
                  (new Date(attempt.resend_after_at).getTime() - now) / 1000,
                ),
              ),
              expires_in_seconds: Math.max(
                1,
                Math.ceil(
                  (new Date(attempt.challenge_expires_at).getTime() - now) /
                    1000,
                ),
              ),
            };
          }
        }
        // Catch existing legacy email case/whitespace variants before writes.
        const matches: Array<{ id: string }> = await manager.query(
          'SELECT id FROM users WHERE lower(btrim(email)) = $1 LIMIT 1',
          [input.email],
        );
        if (matches.length > 0) {
          throw new ConflictException('Account already exists.');
        }

        const user = await manager.save(
          User,
          manager.create(User, {
            email: input.email,
            first_name: input.firstName,
            last_name: input.lastName,
            password: hashedPassword,
            role: [], // No authorization is inferred from public signup.
            account_status: AccountStatus.PENDING_VERIFICATION,
            email_verified_at: null,
            is_active: false,
            is_verified: false,
          }),
        );
        if (input.persona) {
          await manager.insert(UserPersona, {
            user_id: user.id,
            persona_type: input.persona,
            is_active: true,
          });
          // Patient profile ownership is created atomically with the persona.
          // Never create a medical profile for professional-only intent.
          if (input.persona === UserPersonaType.PATIENT) {
            await manager.insert(PatientProfile, { user_id: user.id });
          }
        } else {
          const details = input.organization;
          if (!details) {
            throw new BadRequestException('Organization details required.');
          }
          const org = await manager.save(
            Organization,
            manager.create(Organization, {
              organization_type: details.type,
              name: details.name,
              registration_number: details.registrationNumber,
              location: details.location,
              contact_email: details.contactEmail,
              contact_phone: details.contactPhone,
              verification_status: OrganizationVerificationStatus.PENDING,
              rejection_reason: null,
              is_active: true,
            }),
          );
          await manager.insert(OrganizationMembership, {
            organization_id: org.id,
            user_id: user.id,
            role: OrganizationMembershipRole.OWNER,
            status: OrganizationMembershipStatus.ACTIVE,
            permission_overrides: [],
            joined_at: null,
          });
        }

        const acceptedAt = new Date();
        await manager.insert(LegalAcceptance, [
          {
            user_id: user.id,
            document_type: LegalDocumentType.TERMS_OF_SERVICE,
            document_version: input.acceptedTermsVersion,
            accepted_at: acceptedAt,
          },
          {
            user_id: user.id,
            document_type: LegalDocumentType.PRIVACY_POLICY,
            document_version: input.acceptedPrivacyVersion,
            accepted_at: acceptedAt,
          },
        ]);
        const receipt = await writeChallenge(manager, user);
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            receipt?.challengeId ?? '',
          ) ||
          !Number.isInteger(receipt.resendAfterSeconds) ||
          receipt.resendAfterSeconds < 0 ||
          !Number.isInteger(receipt.expiresInSeconds) ||
          receipt.expiresInSeconds < 1
        ) {
          throw new Error(
            'Durable challenge writer returned invalid metadata.',
          );
        }
        // Event payload must contain no raw code, email or secret.
        await manager.insert(OutboxEvent, {
          aggregate_type: 'auth_challenge',
          aggregate_id: user.id,
          event_type: 'auth.challenge.delivery_requested',
          status: OutboxEventStatus.PENDING,
          payload: {
            challenge_id: receipt.challengeId,
            purpose: 'contact_verification',
          },
        });
        if (retry) {
          const now = Date.now();
          // The same transaction persists the idempotency receipt; a failed
          // challenge writer/outbox insert cannot strand a retry key.
          await manager.query(
            `INSERT INTO registration_attempts
              (request_key_hash, request_fingerprint, user_id, challenge_id,
               challenge_expires_at, resend_after_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              retry.keyHash,
              retry.fingerprint,
              user.id,
              receipt.challengeId,
              new Date(now + receipt.expiresInSeconds * 1000),
              new Date(now + receipt.resendAfterSeconds * 1000),
            ],
          );
        }
        return {
          message: 'Verification queued',
          challenge_id: receipt.challengeId,
          delivery_target: maskRegistrationEmail(input.email),
          resend_after_seconds: receipt.resendAfterSeconds,
          expires_in_seconds: receipt.expiresInSeconds,
        };
      });
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        // Concurrent duplicate requests must resolve to a controlled conflict.
        throw new ConflictException('Registration already exists.');
      }
      throw error;
    }
  }
  private prepareIdempotency(
    key: string,
    password: string,
    input: ReturnType<typeof normalizeRegistrationInput>,
  ): { keyHash: string; fingerprint: string } {
    if (
      typeof key !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      )
    ) {
      throw new BadRequestException(
        'A valid registration request key is required.',
      );
    }
    if (typeof password !== 'string') {
      throw new BadRequestException('A valid password is required.');
    }
    const secret = this.config.get<string>('REGISTRATION_IDEMPOTENCY_PEPPER');
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(
        'REGISTRATION_IDEMPOTENCY_PEPPER must contain at least 32 random bytes.',
      );
    }
    const digest = (label: string, value: string): string =>
      createHmac('sha256', secret)
        .update(label, 'utf8')
        .update(':', 'ascii')
        .update(value, 'utf8')
        .digest('hex');
    return {
      keyHash: digest('ohealth:signup-key:v1', key.toLowerCase()),
      // Include the canonical password form so an altered submission with
      // the same key cannot retrieve a previous challenge receipt.
      // This value is keyed HMAC (never plain or a fast unsalted password hash).
      fingerprint: digest(
        'ohealth:signup-request:v1',
        JSON.stringify({
          ...input,
          password: password.normalize('NFC'),
        }),
      ),
    };
  }

  private matchesFingerprint(expected: string, actual: string): boolean {
    if (!/^[a-f0-9]{64}$/.test(actual)) return false;
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(actual, 'hex'),
    );
  }
}
