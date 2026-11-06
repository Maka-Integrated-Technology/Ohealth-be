import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

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
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AuthChallengeDeliveryService } from '../challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from '../challenges/auth-challenge.entity';
import { RegistrationPendingResponseDto } from '../contracts/auth-contract-response.dto';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';

import {
  IRegistrationLegalVersions,
  INormalizedRegistration,
  maskRegistrationEmail,
  normalizeRegistrationInput,
} from './registration-input.util';

interface IRegistrationMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface IRegistrationConfiguration extends IRegistrationLegalVersions {
  idempotencyPepper: string;
}

interface IRegistrationRetry {
  keyHash: string;
  fingerprint: string;
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly passwords: PasswordCredentialsService,
    private readonly delivery: AuthChallengeDeliveryService,
    private readonly audit: AuthSecurityAuditService,
  ) {}

  assertConfigured(): void {
    this.registrationConfiguration();
  }

  async register(
    dto: RegisterAccountDto,
    idempotencyKey?: string,
    metadata: IRegistrationMetadata = {},
  ): Promise<RegistrationPendingResponseDto> {
    const configuration = this.registrationConfiguration();
    const input = normalizeRegistrationInput(dto, configuration);
    const retry = idempotencyKey
      ? this.prepareIdempotency(
          idempotencyKey,
          dto.password,
          input,
          configuration.idempotencyPepper,
        )
      : null;

    await this.delivery.assertLiveFlowReady();
    const hashedPassword = await this.passwords.hashNewPassword(dto.password);
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (retry) {
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [retry.keyHash],
          );
          const receipts: Array<{
            request_fingerprint: string;
            user_id: string;
          }> = await manager.query(
            `SELECT request_fingerprint, user_id
             FROM registration_attempts
             WHERE request_key_hash = $1
             FOR UPDATE`,
            [retry.keyHash],
          );
          if (receipts.length) {
            const receipt = receipts[0];
            const users: Array<{
              email: string;
              account_status: AccountStatus;
            }> = await manager.query(
              `SELECT email, account_status
               FROM users
               WHERE id = $1
               FOR UPDATE`,
              [receipt.user_id],
            );
            if (!users.length) {
              throw new ConflictException('Registration retry is unavailable.');
            }
            const challenges: Array<{
              challenge_id: string;
              issued_at: Date;
              expires_at: Date;
            }> = await manager.query(
              `SELECT id AS challenge_id, issued_at, expires_at
               FROM auth_challenges
               WHERE subject_user_id = $1
                 AND purpose = $2
                 AND consumed_at IS NULL
                 AND expires_at > now()
               ORDER BY issued_at DESC
               LIMIT 1
               FOR UPDATE`,
              [receipt.user_id, AuthChallengePurpose.CONTACT_VERIFICATION],
            );
            return this.replay(
              {
                request_fingerprint: receipt.request_fingerprint,
                email: users[0].email,
                account_status: users[0].account_status,
                challenge_id: challenges[0]?.challenge_id ?? null,
                issued_at: challenges[0]?.issued_at ?? null,
                expires_at: challenges[0]?.expires_at ?? null,
              },
              retry.fingerprint,
            );
          }
        }

        const matches: Array<{ id: string }> = await manager.query(
          'SELECT id FROM users WHERE lower(btrim(email)) = $1 LIMIT 1',
          [input.email],
        );
        if (matches.length) {
          throw new ConflictException('Account already exists.');
        }

        const user = await manager.save(
          User,
          manager.create(User, {
            email: input.email,
            password: hashedPassword,
            first_name: input.firstName,
            last_name: input.lastName,
            role: [],
            account_status: AccountStatus.PENDING_VERIFICATION,
            email_verified_at: null,
            is_active: false,
            is_verified: false,
            verification_code: null,
            verification_code_expires_at: null,
            reset_token: null,
            reset_token_expiry: null,
          }),
        );

        if (input.personaType) {
          await manager.insert(UserPersona, {
            user_id: user.id,
            persona_type: input.personaType,
            is_active: true,
          });
          if (input.personaType === UserPersonaType.PATIENT) {
            await manager.insert(PatientProfile, { user_id: user.id });
          }
        } else {
          const details = input.organization;
          if (!details) {
            throw new Error('Organization registration mapping is missing.');
          }
          const organization = await manager.save(
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
            organization_id: organization.id,
            user_id: user.id,
            role: OrganizationMembershipRole.OWNER,
            status: OrganizationMembershipStatus.ACTIVE,
            permission_overrides: [],
            joined_at: null,
          });
        }

        const acceptedAt = new Date();
        const ipAddress = this.safeIp(metadata.ipAddress);
        const userAgent = this.safeUserAgent(metadata.userAgent);
        await manager.insert(LegalAcceptance, [
          {
            user_id: user.id,
            document_type: LegalDocumentType.TERMS_OF_SERVICE,
            document_version: input.acceptedTermsVersion,
            accepted_at: acceptedAt,
            ip_address: ipAddress,
            user_agent: userAgent,
          },
          {
            user_id: user.id,
            document_type: LegalDocumentType.PRIVACY_POLICY,
            document_version: input.acceptedPrivacyVersion,
            accepted_at: acceptedAt,
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        ]);

        const challenge = await this.delivery.queueInTransaction(
          manager,
          user,
          AuthChallengePurpose.CONTACT_VERIFICATION,
        );
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.REGISTRATION,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          subject_user_id: user.id,
        });
        if (retry) {
          await manager.query(
            `INSERT INTO registration_attempts
              (request_key_hash, request_fingerprint, user_id, challenge_id)
             VALUES ($1, $2, $3, $4)`,
            [retry.keyHash, retry.fingerprint, user.id, challenge.challengeId],
          );
        }
        return {
          message: 'Verification queued',
          challenge_id: challenge.challengeId,
          delivery_target: maskRegistrationEmail(input.email),
          resend_after_seconds: challenge.resendAfterSeconds,
          expires_in_seconds: challenge.expiresInSeconds,
        };
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Registration already exists.');
      }
      throw error;
    }
  }

  private replay(
    previous: {
      request_fingerprint: string;
      email: string;
      account_status: AccountStatus;
      challenge_id: string | null;
      issued_at: Date | null;
      expires_at: Date | null;
    },
    expectedFingerprint: string,
  ): RegistrationPendingResponseDto {
    if (
      !this.matchesFingerprint(
        expectedFingerprint,
        previous.request_fingerprint,
      ) ||
      previous.account_status !== AccountStatus.PENDING_VERIFICATION ||
      !previous.challenge_id ||
      !previous.issued_at ||
      !previous.expires_at
    ) {
      throw new ConflictException('Registration retry is unavailable.');
    }
    const now = Date.now();
    return {
      message: 'Verification queued',
      challenge_id: previous.challenge_id,
      delivery_target: maskRegistrationEmail(previous.email),
      resend_after_seconds: Math.max(
        0,
        Math.ceil(
          (new Date(previous.issued_at).getTime() + 60_000 - now) / 1000,
        ),
      ),
      expires_in_seconds: Math.max(
        1,
        Math.ceil((new Date(previous.expires_at).getTime() - now) / 1000),
      ),
    };
  }

  private registrationConfiguration(): IRegistrationConfiguration {
    const configuration = {
      terms: this.config.get<string>('registration.termsVersion') ?? '',
      privacy: this.config.get<string>('registration.privacyVersion') ?? '',
      idempotencyPepper:
        this.config.get<string>('registration.idempotencyPepper') ?? '',
    };
    if (
      !configuration.terms.trim() ||
      !configuration.privacy.trim() ||
      configuration.terms.trim().length > 50 ||
      configuration.privacy.trim().length > 50 ||
      Buffer.byteLength(configuration.idempotencyPepper, 'utf8') < 32
    ) {
      throw new Error(
        'Registration legal versions and a 32-byte idempotency pepper are required.',
      );
    }
    return configuration;
  }

  private prepareIdempotency(
    key: string,
    password: string,
    input: INormalizedRegistration,
    pepper: string,
  ): IRegistrationRetry {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      )
    ) {
      throw new BadRequestException(
        'Idempotency-Key must be a valid UUID version 4.',
      );
    }
    const digest = (label: string, value: string): string =>
      createHmac('sha256', pepper)
        .update(label, 'utf8')
        .update(':', 'ascii')
        .update(value, 'utf8')
        .digest('hex');
    return {
      keyHash: digest('ohealth:registration-key:v1', key.toLowerCase()),
      fingerprint: digest(
        'ohealth:registration-request:v1',
        JSON.stringify({ ...input, password: password.normalize('NFC') }),
      ),
    };
  }

  private matchesFingerprint(expected: string, actual: string): boolean {
    return (
      /^[a-f0-9]{64}$/.test(actual) &&
      timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
    );
  }

  private safeIp(value?: string): string | null {
    if (!value) return null;
    const normalized = value.startsWith('::ffff:') ? value.slice(7) : value;
    return isIP(normalized) ? normalized : null;
  }

  private safeUserAgent(value?: string): string | null {
    if (!value) return null;
    return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 512) || null;
  }
}
