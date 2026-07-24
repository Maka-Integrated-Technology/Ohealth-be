import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { EmailService } from '../email/email.service';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationType } from '../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../organization/enums/organization-verification-status.enum';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryOperatingHour } from './entities/laboratory-operating-hour.entity';
import { LaboratoryStaff } from './entities/laboratory-staff.entity';
import { LaboratoryTest } from './entities/laboratory-test.entity';
import {
  DayOfWeek,
  LaboratoryStaffRole,
  LaboratoryStaffStatus,
} from './enums/laboratory-post-approval.enum';
import { LaboratoryPostApprovalService } from './laboratory-post-approval.service';

describe('LaboratoryPostApprovalService', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const approvedLaboratory = {
    id: 'organization-id',
    name: 'MedCheck Laboratory',
    organization_type: OrganizationType.LABORATORY,
    verification_status: OrganizationVerificationStatus.APPROVED,
    is_active: true,
  } as Organization;
  const organizations = { findOne: jest.fn() };
  const administrators = { findOne: jest.fn() };
  const operatingHours = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const laboratoryTests = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const laboratoryStaff = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const users = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({ withRepository: (repository: unknown) => repository }),
    ),
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values = new Map<string, unknown>([
        ['HASH_SALT', '10'],
        ['invite.expirationDays', 7],
        ['mail.from.address', 'noreply@ohealth.test'],
        ['mail.from.name', 'OHealth'],
        ['frontend.url', 'https://app.ohealth.test'],
      ]);
      return values.get(key) ?? fallback;
    }),
  };
  const email = { sendMail: jest.fn() };
  const logger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  let service: LaboratoryPostApprovalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LaboratoryPostApprovalService(
      organizations as unknown as Repository<Organization>,
      administrators as unknown as Repository<OrganizationAdmin>,
      operatingHours as unknown as Repository<LaboratoryOperatingHour>,
      laboratoryTests as unknown as Repository<LaboratoryTest>,
      laboratoryStaff as unknown as Repository<LaboratoryStaff>,
      users as unknown as Repository<User>,
      dataSource as unknown as DataSource,
      config as unknown as ConfigService,
      email as unknown as EmailService,
      logger as unknown as Logger,
    );
    administrators.findOne.mockResolvedValue({
      organization: approvedLaboratory,
    });
    organizations.findOne.mockResolvedValue(approvedLaboratory);
    operatingHours.findOne.mockResolvedValue(null);
    operatingHours.find.mockResolvedValue([]);
    operatingHours.save.mockImplementation(async (records: object[]) =>
      records.map((record, index) => ({
        id: `hour-${index}`,
        created_at: now,
        updated_at: now,
        ...record,
      })),
    );
    laboratoryTests.findOne.mockResolvedValue(null);
    laboratoryTests.find.mockResolvedValue([]);
    laboratoryTests.save.mockImplementation(async (record: object) => ({
      id: 'test-id',
      created_at: now,
      updated_at: now,
      ...record,
    }));
    laboratoryStaff.findOne.mockResolvedValue(null);
    laboratoryStaff.find.mockResolvedValue([]);
    laboratoryStaff.save.mockImplementation(async (record: object) => ({
      id: 'staff-id',
      created_at: now,
      updated_at: now,
      ...record,
    }));
    users.findOne.mockResolvedValue(null);
    users.save.mockImplementation(async (record: object) => ({
      id: 'staff-user-id',
      ...record,
    }));
    email.sendMail.mockResolvedValue(undefined);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashed');
  });

  afterEach(() => jest.restoreAllMocks());

  it('upserts and returns operating hours in weekday order', async () => {
    const result = await service.setOperatingHours('admin-id', {
      hours: [
        {
          day_of_week: DayOfWeek.FRIDAY,
          is_closed: true,
        },
        {
          day_of_week: DayOfWeek.MONDAY,
          is_closed: false,
          opens_at: '08:00',
          closes_at: '18:00',
        },
      ],
    });

    expect(operatingHours.save).toHaveBeenCalledWith([
      expect.objectContaining({
        organization_id: approvedLaboratory.id,
        day_of_week: DayOfWeek.FRIDAY,
        opens_at: null,
        closes_at: null,
      }),
      expect.objectContaining({
        day_of_week: DayOfWeek.MONDAY,
        opens_at: '08:00:00',
        closes_at: '18:00:00',
      }),
    ]);
    expect(result.map((entry) => entry.day_of_week)).toEqual([
      DayOfWeek.MONDAY,
      DayOfWeek.FRIDAY,
    ]);
  });

  it('rejects duplicate or internally inconsistent operating hours', async () => {
    await expect(
      service.setOperatingHours('admin-id', {
        hours: [
          { day_of_week: DayOfWeek.MONDAY, is_closed: true },
          { day_of_week: DayOfWeek.MONDAY, is_closed: true },
        ],
      }),
    ).rejects.toThrow(sysMsg.LABORATORY_OPERATING_HOURS_DUPLICATE_DAY);

    await expect(
      service.setOperatingHours('admin-id', {
        hours: [
          {
            day_of_week: DayOfWeek.TUESDAY,
            is_closed: false,
            opens_at: '18:00',
            closes_at: '08:00',
          },
        ],
      }),
    ).rejects.toThrow(sysMsg.LABORATORY_OPERATING_HOURS_INVALID);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects setup access before laboratory approval', async () => {
    administrators.findOne.mockResolvedValue({
      organization: {
        ...approvedLaboratory,
        verification_status: OrganizationVerificationStatus.UNDER_REVIEW,
      },
    });

    await expect(service.listTests('admin-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('normalizes and creates a test within the owning laboratory', async () => {
    const result = await service.createTest('admin-id', {
      name: '  Full   Blood Count ',
      price: 15000,
      turnaround_time_minutes: 1440,
    });

    expect(laboratoryTests.create).toHaveBeenCalledWith({
      organization_id: approvedLaboratory.id,
      name: 'Full Blood Count',
      normalized_name: 'full blood count',
      price: 15000,
      turnaround_time_minutes: 1440,
      is_active: true,
    });
    expect(result).toMatchObject({
      id: 'test-id',
      name: 'Full Blood Count',
      price: 15000,
    });
  });

  it('rejects a duplicate test name case-insensitively', async () => {
    laboratoryTests.findOne.mockResolvedValue({ id: 'duplicate-id' });

    await expect(
      service.createTest('admin-id', {
        name: 'FULL BLOOD COUNT',
        price: 12000,
        turnaround_time_minutes: 60,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(laboratoryTests.save).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only names at the service boundary', async () => {
    await expect(
      service.createTest('admin-id', {
        name: '   ',
        price: 1000,
        turnaround_time_minutes: 60,
      }),
    ).rejects.toThrow(sysMsg.LABORATORY_TEST_NAME_REQUIRED);

    await expect(
      service.inviteStaff('admin-id', {
        full_name: '   ',
        email: 'staff@lab.test',
        role: LaboratoryStaffRole.TECHNICIAN,
      }),
    ).rejects.toThrow(sysMsg.LABORATORY_STAFF_NAME_REQUIRED);
  });

  it('does not update a test owned by another laboratory', async () => {
    laboratoryTests.findOne.mockResolvedValue(null);

    await expect(
      service.updateTest('admin-id', 'other-test-id', { price: 20000 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(laboratoryTests.findOne).toHaveBeenCalledWith({
      where: {
        id: 'other-test-id',
        organization_id: approvedLaboratory.id,
      },
    });
  });

  it('creates a hashed, expiring staff invitation and sends email', async () => {
    const result = await service.inviteStaff('admin-id', {
      full_name: '  Amara   Okafor ',
      email: 'AMARA@LAB.TEST',
      role: LaboratoryStaffRole.SCIENTIST,
    });

    expect(laboratoryStaff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: approvedLaboratory.id,
        invited_by_user_id: 'admin-id',
        full_name: 'Amara Okafor',
        email: 'amara@lab.test',
        role: LaboratoryStaffRole.SCIENTIST,
        status: LaboratoryStaffStatus.INVITED,
        invitation_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        invitation_expires_at: expect.any(Date),
      }),
    );
    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: 'amara@lab.test', name: 'Amara Okafor' }],
      }),
    );
    expect(result.message).toBe(sysMsg.LABORATORY_STAFF_INVITED);
    expect(result.staff).not.toHaveProperty('invitation_token_hash');
  });

  it('rejects an invitation for an email already registered as a user', async () => {
    users.findOne.mockResolvedValue({ id: 'existing-user-id' });

    await expect(
      service.inviteStaff('admin-id', {
        full_name: 'Existing User',
        email: 'existing@lab.test',
        role: LaboratoryStaffRole.TECHNICIAN,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(laboratoryStaff.save).not.toHaveBeenCalled();
  });

  it('does not report invitation success when email delivery fails', async () => {
    email.sendMail.mockRejectedValueOnce(new Error('mail unavailable'));

    await expect(
      service.inviteStaff('admin-id', {
        full_name: 'Amara Okafor',
        email: 'amara@lab.test',
        role: LaboratoryStaffRole.SCIENTIST,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(logger.error).toHaveBeenCalled();
  });

  it('atomically activates an invitation and creates a lab staff account', async () => {
    const invitation = {
      id: 'staff-id',
      organization_id: approvedLaboratory.id,
      user_id: null,
      invited_by_user_id: 'admin-id',
      full_name: 'Amara Chidi Okafor',
      email: 'amara@lab.test',
      role: LaboratoryStaffRole.SCIENTIST,
      status: LaboratoryStaffStatus.INVITED,
      invitation_token_hash: 'stored-token-hash',
      invitation_expires_at: new Date(Date.now() + 60_000),
      accepted_at: null,
      created_at: now,
      updated_at: now,
    } as unknown as LaboratoryStaff;
    laboratoryStaff.findOne.mockResolvedValue(invitation);

    const result = await service.acceptStaffInvitation({
      token: 'a'.repeat(64),
      password: 'SecurePassword123',
      phone: '+2348012345678',
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: invitation.email,
        password: 'hashed',
        first_name: 'Amara',
        middle_name: 'Chidi',
        last_name: 'Okafor',
        role: [UserRole.LAB_STAFF],
        is_active: true,
        is_verified: true,
      }),
    );
    expect(laboratoryStaff.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'staff-user-id',
        status: LaboratoryStaffStatus.ACTIVE,
        invitation_token_hash: null,
        invitation_expires_at: null,
        accepted_at: expect.any(Date),
      }),
    );
    expect(result.message).toBe(sysMsg.LABORATORY_STAFF_INVITATION_ACCEPTED);
  });

  it('rejects an expired invitation before hashing a password', async () => {
    laboratoryStaff.findOne.mockResolvedValue({
      status: LaboratoryStaffStatus.INVITED,
      invitation_token_hash: 'hash',
      invitation_expires_at: new Date(Date.now() - 60_000),
    });

    await expect(
      service.acceptStaffInvitation({
        token: 'a'.repeat(64),
        password: 'SecurePassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});
