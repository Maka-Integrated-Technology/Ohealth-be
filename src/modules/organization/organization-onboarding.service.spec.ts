import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { SetupOrganizationDto } from './dto/organization-setup.dto';
import { OrganizationAdmin } from './entities/organization-admin.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationType } from './enums/organization-type.enum';
import { OrganizationOnboardingService } from './organization-onboarding.service';

describe('OrganizationOnboardingService', () => {
  const organizations = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const administrators = {
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
  const logger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
  };
  const dto: SetupOrganizationDto = {
    organization: {
      organization_type: OrganizationType.HOSPITAL,
      name: ' City Hospital ',
      registration_number: ' RC-1 ',
      location: ' Lagos ',
      contact_email: 'Contact@Hospital.test',
      contact_phone: '+2348000000000',
    },
    administrator: {
      full_name: ' Ada   Obi ',
      email: 'Admin@Hospital.test',
      phone: '+2348111111111',
      password: 'Password123',
    },
  };
  let service: OrganizationOnboardingService;

  beforeEach(() => {
    service = new OrganizationOnboardingService(
      organizations as unknown as Repository<Organization>,
      administrators as unknown as Repository<OrganizationAdmin>,
      users as unknown as Repository<User>,
      dataSource as unknown as DataSource,
      { get: jest.fn().mockReturnValue('10') } as unknown as ConfigService,
      logger as unknown as Logger,
    );
    jest.clearAllMocks();
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashed');
    organizations.findOne.mockResolvedValue(null);
    users.findOne.mockResolvedValue(null);
    organizations.save.mockImplementation(async (value) => ({
      id: 'organization-id',
      created_at: new Date(),
      ...value,
    }));
    users.save.mockImplementation(async (value) => ({
      id: 'user-id',
      ...value,
    }));
    administrators.save.mockImplementation(async (value) => ({
      id: 'administrator-id',
      ...value,
    }));
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [OrganizationType.HOSPITAL, UserRole.HOSPITAL_ADMIN],
    [OrganizationType.LABORATORY, UserRole.LAB_ADMIN],
    [OrganizationType.PHARMACY, UserRole.PHARMACY_ADMIN],
  ])(
    'atomically creates a %s organization administrator',
    async (type, role) => {
      const result = await service.setupAdministrator({
        ...dto,
        organization: { ...dto.organization, organization_type: type },
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@hospital.test',
          password: 'hashed',
          role: [role],
          is_active: true,
          is_verified: true,
        }),
      );
      expect(administrators.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'organization-id',
          user_id: 'user-id',
          full_name: 'Ada Obi',
        }),
      );
      expect(result.organization.organization_type).toBe(type);
      expect(result).not.toHaveProperty('access_token');
    },
  );

  it('rejects an administrator email already used by any account', async () => {
    users.findOne.mockResolvedValue({ id: 'existing-user' });

    await expect(service.setupAdministrator(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(organizations.save).not.toHaveBeenCalled();
  });

  it('rejects a duplicate registration number', async () => {
    organizations.findOne.mockResolvedValue({ id: 'existing-organization' });

    await expect(service.setupAdministrator(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid organization type at the service boundary', async () => {
    await expect(
      service.setupAdministrator({
        ...dto,
        organization: {
          ...dto.organization,
          organization_type: 'clinic' as OrganizationType,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});
