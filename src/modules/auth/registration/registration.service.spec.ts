import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AuthChallengeDeliveryService } from '../challenges/auth-challenge-delivery.service';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { SignupIntent } from '../enums/signup-intent.enum';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';

import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  const inserted: Array<{ entity: unknown; values: unknown }> = [];
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>(
    async (sql) => {
      if (sql.includes('FROM registration_attempts')) return [];
      if (sql.includes('FROM users')) return [];
      return [];
    },
  );
  const manager = {
    query,
    create: jest.fn((_entity, values) => values),
    save: jest.fn(async (entity, values) => ({
      ...values,
      id: entity === User ? 'user-id' : 'organization-id',
    })),
    insert: jest.fn(async (entity, values) => {
      inserted.push({ entity, values });
      return {};
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) => callback(manager)),
  } as unknown as DataSource;
  const settings = new Map<string, string>([
    ['registration.termsVersion', 'terms-v1'],
    ['registration.privacyVersion', 'privacy-v1'],
    ['registration.idempotencyPepper', 'p'.repeat(32)],
  ]);
  const config = {
    get: jest.fn((key: string) => settings.get(key)),
  } as unknown as ConfigService;
  const passwords = {
    hashNewPassword: jest.fn().mockResolvedValue('password-hash'),
  } as unknown as PasswordCredentialsService;
  const delivery = {
    assertLiveFlowReady: jest.fn().mockResolvedValue(undefined),
    queueInTransaction: jest.fn().mockResolvedValue({
      challengeId: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    }),
  } as unknown as AuthChallengeDeliveryService;
  const audit = {
    recordInTransaction: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuthSecurityAuditService;
  const service = new RegistrationService(
    dataSource,
    config,
    passwords,
    delivery,
    audit,
  );

  const base = (intent: SignupIntent): RegisterAccountDto => ({
    first_name: 'Ada',
    last_name: 'Okafor',
    email: 'ADA@example.com',
    password: 'a memorable registration passphrase',
    intent,
    accepted_terms_version: 'terms-v1',
    accepted_privacy_version: 'privacy-v1',
  });
  const organization = (intent: SignupIntent): RegisterAccountDto => ({
    ...base(intent),
    organization: {
      name: 'OHealth Centre',
      registration_number: 'rc-001',
      location: 'Lagos',
      contact_email: 'contact@example.com',
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    inserted.length = 0;
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM registration_attempts')) return [];
      if (sql.includes('FROM users')) return [];
      return [];
    });
    manager.save.mockImplementation(async (entity, values) => ({
      ...values,
      id: entity === User ? 'user-id' : 'organization-id',
    }));
  });

  it.each([
    [SignupIntent.PATIENT, UserPersonaType.PATIENT, true],
    [
      SignupIntent.HEALTHCARE_PROFESSIONAL,
      UserPersonaType.HEALTHCARE_PROFESSIONAL,
      false,
    ],
  ])(
    'atomically creates the %s persona',
    async (intent, personaType, patient) => {
      const response = await service.register(base(intent));
      expect(manager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          email: 'ada@example.com',
          account_status: AccountStatus.PENDING_VERIFICATION,
          is_active: false,
        }),
      );
      const savedUser = manager.save.mock.calls.find(
        ([entity]) => entity === User,
      )?.[1] as { role: unknown };
      expect(savedUser.role).toStrictEqual([]);
      expect(inserted).toContainEqual({
        entity: UserPersona,
        values: expect.objectContaining({ persona_type: personaType }),
      });
      expect(inserted.some((entry) => entry.entity === PatientProfile)).toBe(
        patient,
      );
      expect(
        inserted.filter((entry) => entry.entity === LegalAcceptance),
      ).toHaveLength(1);
      expect(response).toMatchObject({
        challenge_id: expect.any(String),
        delivery_target: 'a***@example.com',
      });
      expect(response).not.toHaveProperty('access_token');
      expect(response).not.toHaveProperty('refresh_token');
    },
  );

  it.each([
    [SignupIntent.PHARMACY, OrganizationType.PHARMACY],
    [SignupIntent.LABORATORY, OrganizationType.LABORATORY],
    [SignupIntent.HOSPITAL, OrganizationType.HOSPITAL],
  ])('creates a pending %s and owner membership', async (intent, type) => {
    await service.register(organization(intent));
    expect(manager.save).toHaveBeenCalledWith(
      Organization,
      expect.objectContaining({ organization_type: type }),
    );
    expect(inserted).toContainEqual({
      entity: OrganizationMembership,
      values: expect.objectContaining({
        organization_id: 'organization-id',
        user_id: 'user-id',
        role: OrganizationMembershipRole.OWNER,
      }),
    });
  });

  it('persists legal evidence and the delivery receipt in the same transaction', async () => {
    await service.register(
      base(SignupIntent.PATIENT),
      '550e8400-e29b-41d4-a716-446655440000',
      { ipAddress: '::ffff:127.0.0.1', userAgent: 'test\u0000-agent' },
    );
    expect(inserted).toContainEqual({
      entity: LegalAcceptance,
      values: expect.arrayContaining([
        expect.objectContaining({
          document_version: 'terms-v1',
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
        }),
        expect.objectContaining({ document_version: 'privacy-v1' }),
      ]),
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO registration_attempts'),
      expect.arrayContaining(['user-id']),
    );
    expect(delivery.queueInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'user-id' }),
      'contact_verification',
    );
  });

  it('replays an identical pending request without creating another user', async () => {
    const now = Date.now();
    let fingerprint = '';
    query.mockImplementation(async (sql: string, parameters?: unknown[]) => {
      if (sql.includes('INSERT INTO registration_attempts')) {
        fingerprint = String(parameters?.[1]);
        return [];
      }
      if (sql.includes('FROM registration_attempts') && fingerprint) {
        return [
          {
            request_fingerprint: fingerprint,
            email: 'ada@example.com',
            account_status: AccountStatus.PENDING_VERIFICATION,
            challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
            issued_at: new Date(now),
            expires_at: new Date(now + 600_000),
          },
        ];
      }
      return [];
    });
    const key = '550e8400-e29b-41d4-a716-446655440000';
    await service.register(base(SignupIntent.PATIENT), key);
    jest.clearAllMocks();
    const replayed = await service.register(base(SignupIntent.PATIENT), key);
    expect(replayed.challenge_id).toBe('f64031c5-70e4-4b37-a92c-f193e59a6621');
    expect(manager.save).not.toHaveBeenCalled();
    expect(delivery.queueInTransaction).not.toHaveBeenCalled();
    await expect(
      service.register(
        { ...base(SignupIntent.PATIENT), last_name: 'Different' },
        key,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects malformed retry keys and normalized duplicate races', async () => {
    await expect(
      service.register(base(SignupIntent.PATIENT), 'predictable-key'),
    ).rejects.toThrow(BadRequestException);
    query.mockRejectedValueOnce({ code: '23505' });
    await expect(service.register(base(SignupIntent.PATIENT))).rejects.toThrow(
      ConflictException,
    );
  });

  it('fails closed when legal versions or the independent pepper are unsafe', () => {
    settings.set('registration.idempotencyPepper', 'too-short');
    expect(() => service.assertConfigured()).toThrow(
      'Registration legal versions and a 32-byte idempotency pepper are required.',
    );
    settings.set('registration.idempotencyPepper', 'p'.repeat(32));
    settings.set('registration.termsVersion', 'v'.repeat(51));
    expect(() => service.assertConfigured()).toThrow();
    settings.set('registration.termsVersion', 'terms-v1');
  });
});
