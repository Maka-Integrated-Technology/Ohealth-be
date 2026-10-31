import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { SignupIntent } from '../enums/signup-intent.enum';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';

import { RegistrationRecordsService } from './registration-records.service';

const UUID = 'cd66040f-0c6e-4a26-bc81-48be456f07cb';
const input: RegisterAccountDto = {
  first_name: 'Ada',
  last_name: 'Okafor',
  email: ' ADA@EXAMPLE.COM ',
  password: 'a long unique passphrase',
  intent: SignupIntent.PATIENT,
  accepted_terms_version: 'terms-v3',
  accepted_privacy_version: 'privacy-v4',
};

describe('RegistrationRecordsService transactional foundation', () => {
  const persisted: Array<{ entity: unknown; record: unknown }> = [];
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => ({
      ...value,
      id: UUID,
    })),
    insert: jest.fn(async (entity: unknown, record: unknown) => {
      persisted.push({ entity, record });
    }),
  };
  const dataSource = {
    transaction: jest.fn(
      async (callback: (m: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    ),
  };
  const passwords = {
    hashNewPassword: jest.fn().mockResolvedValue('safe-hash'),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'REGISTRATION_TERMS_VERSION') return 'terms-v3';
      if (key === 'REGISTRATION_PRIVACY_VERSION') return 'privacy-v4';
      return undefined;
    }),
  };
  const service = new RegistrationRecordsService(
    dataSource as unknown as DataSource,
    passwords as unknown as PasswordCredentialsService,
    config as unknown as ConfigService,
  );
  const writer = jest.fn(async () => ({
    challengeId: UUID,
    resendAfterSeconds: 60,
    expiresInSeconds: 600,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    persisted.length = 0;
    manager.query.mockResolvedValue([]);
    passwords.hashNewPassword.mockResolvedValue('safe-hash');
  });

  it('persists pending user, persona, legal acceptance and safe delivery event in one transaction', async () => {
    const response = await service.registerPending(input, writer);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        email: 'ada@example.com',
        role: [],
        account_status: AccountStatus.PENDING_VERIFICATION,
        is_active: false,
        is_verified: false,
      }),
    );
    expect(persisted.map((item) => item.entity)).toEqual([
      UserPersona,
      PatientProfile,
      LegalAcceptance,
      OutboxEvent,
    ]);
    expect(persisted[2].record).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ document_type: 'terms_of_service' }),
        expect.objectContaining({ document_type: 'privacy_policy' }),
      ]),
    );
    expect(persisted[3].record).toMatchObject({
      event_type: 'auth.challenge.delivery_requested',
      payload: {
        challenge_id: UUID,
        purpose: 'contact_verification',
      },
    });
    expect(response).toEqual({
      message: 'Verification queued',
      challenge_id: UUID,
      delivery_target: 'a***@example.com',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    });
    expect(JSON.stringify(response)).not.toContain('safe-hash');
  });

  it('does not create a clinical patient profile for professional intent', async () => {
    await service.registerPending(
      { ...input, intent: SignupIntent.HEALTHCARE_PROFESSIONAL },
      writer,
    );
    expect(persisted.map((item) => item.entity)).toEqual([
      UserPersona,
      LegalAcceptance,
      OutboxEvent,
    ]);
    expect(persisted.some((item) => item.entity === PatientProfile)).toBe(
      false,
    );
  });

  it.each(Object.values(OrganizationType))(
    'creates a %s organization and its owner membership inside the transaction',
    async (organizationType) => {
      await service.registerPending(
        {
          ...input,
          intent: SignupIntent.ORGANIZATION,
          organization: {
            organization_type: organizationType,
            name: 'OHealth Centre',
            registration_number: 'RC-1234',
            location: 'Abuja',
            contact_email: 'frontdesk@example.com',
          },
        },
        writer,
      );
      expect(persisted.map((item) => item.entity)).toEqual([
        OrganizationMembership,
        LegalAcceptance,
        OutboxEvent,
      ]);
      expect(manager.save).toHaveBeenCalledWith(
        Organization,
        expect.objectContaining({ organization_type: organizationType }),
      );
      expect(persisted[0].record).toMatchObject({
        role: 'owner',
        status: 'active',
        user_id: UUID,
      });
    },
  );

  it('rejects an existing normalized email without writing any identity data', async () => {
    manager.query.mockResolvedValueOnce([{ id: UUID }]);
    await expect(service.registerPending(input, writer)).rejects.toThrow(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(writer).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique constraint violation to HTTP 409', async () => {
    manager.save.mockRejectedValueOnce({ code: '23505' });
    await expect(service.registerPending(input, writer)).rejects.toThrow(
      ConflictException,
    );
  });

  it('fails closed when challenge writer rejects or returns invalid metadata', async () => {
    await expect(
      service.registerPending(input, async () => {
        throw new Error('Delivery envelope cannot be persisted');
      }),
    ).rejects.toThrow('Delivery envelope cannot be persisted');
    await expect(
      service.registerPending(input, async () => ({
        challengeId: 'invalid',
        resendAfterSeconds: 0,
        expiresInSeconds: 600,
      })),
    ).rejects.toThrow('Durable challenge writer returned invalid metadata.');
  });
});
