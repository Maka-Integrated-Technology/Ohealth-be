import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { AuthService } from '../auth/auth.service';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryAdminSetupDto } from './dto/laboratory-admin-setup.dto';
import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryOnboardingStatus } from './enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from './enums/laboratory-verification-status.enum';
import { LaboratoryAuthService } from './laboratory-auth.service';

describe('LaboratoryAuthService', () => {
  let service: LaboratoryAuthService;

  const createdAt = new Date('2026-07-11T10:30:00.000Z');
  const sessionExpiresAt = new Date('2026-07-18T10:30:00.000Z');

  const mockLaboratoryRepository = {
    findOne: jest.fn(),
    create: jest.fn((payload: Partial<Laboratory>) => payload),
    save: jest.fn(),
  };

  const mockLaboratoryAdminRepository = {
    create: jest.fn((payload: Partial<LaboratoryAdmin>) => payload),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn((payload: Partial<User>) => payload),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockAuthService = {
    issueAuthSession: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'HASH_SALT' ? '10' : fallback,
    ),
  };

  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  const payload: LaboratoryAdminSetupDto = {
    laboratory: {
      name: ' MedCheck Diagnostics ',
      registration_number: ' RC-123456 ',
      license_number: ' LAB-987654 ',
      address: ' 12 Admiralty Way, Lekki ',
      region: ' Lagos ',
      contact_email: ' HELLO@MEDCHECK.EXAMPLE ',
      contact_phone: ' +2348012345678 ',
    },
    administrator: {
      full_name: ' Tunde  Ade  Adebayo ',
      email: ' TUNDE@MEDCHECK.EXAMPLE ',
      phone: ' +2348098765432 ',
      password: 'SecurePassword123',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryAuthService,
        {
          provide: getRepositoryToken(Laboratory),
          useValue: mockLaboratoryRepository,
        },
        {
          provide: getRepositoryToken(LaboratoryAdmin),
          useValue: mockLaboratoryAdminRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<LaboratoryAuthService>(LaboratoryAuthService);
    jest.clearAllMocks();

    mockDataSource.transaction.mockImplementation(
      async (
        callback: (manager: {
          withRepository: <T>(repository: T) => T;
        }) => Promise<unknown>,
      ) =>
        callback({
          withRepository: <T>(repository: T) => repository,
        }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a laboratory, primary admin user, admin profile, and auth session', async () => {
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation(async () => 'hashed-password');

    mockUserRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.save.mockImplementation(
      async (laboratory: Partial<Laboratory>) => ({
        id: 'laboratory-id',
        created_at: createdAt,
        ...laboratory,
      }),
    );
    mockUserRepository.save.mockImplementation(async (user: Partial<User>) => ({
      id: 'user-id',
      ...user,
    }));
    mockLaboratoryAdminRepository.save.mockImplementation(
      async (administrator: Partial<LaboratoryAdmin>) => ({
        id: 'administrator-id',
        ...administrator,
      }),
    );
    mockAuthService.issueAuthSession.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      session_id: 'session-id',
      session_expires_at: sessionExpiresAt,
    });

    const result = await service.setupAdministrator(payload);

    expect(bcrypt.hash).toHaveBeenCalledWith('SecurePassword123', 10);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'tunde@medcheck.example' },
    });
    expect(mockLaboratoryRepository.findOne).toHaveBeenCalledWith({
      where: [
        { registration_number: 'RC-123456' },
        { license_number: 'LAB-987654' },
      ],
    });
    expect(mockLaboratoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'MedCheck Diagnostics',
        registration_number: 'RC-123456',
        license_number: 'LAB-987654',
        contact_email: 'hello@medcheck.example',
        verification_status: LaboratoryVerificationStatus.PENDING,
        onboarding_status: LaboratoryOnboardingStatus.ADMIN_SETUP_COMPLETED,
      }),
    );
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'tunde@medcheck.example',
        password: 'hashed-password',
        first_name: 'Tunde',
        middle_name: 'Ade',
        last_name: 'Adebayo',
        role: [UserRole.LAB_ADMIN],
        is_active: true,
        is_verified: true,
      }),
    );
    expect(mockLaboratoryAdminRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        laboratory_id: 'laboratory-id',
        user_id: 'user-id',
        full_name: 'Tunde Ade Adebayo',
        phone: '+2348098765432',
        is_primary: true,
      }),
    );
    expect(mockAuthService.issueAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-id', role: [UserRole.LAB_ADMIN] }),
    );
    expect(result).toEqual({
      message: sysMsg.LABORATORY_ADMIN_SETUP_COMPLETED,
      laboratory: expect.objectContaining({
        id: 'laboratory-id',
        contact_email: 'hello@medcheck.example',
        onboarding_status: LaboratoryOnboardingStatus.ADMIN_SETUP_COMPLETED,
      }),
      administrator: expect.objectContaining({
        id: 'administrator-id',
        user_id: 'user-id',
        email: 'tunde@medcheck.example',
        role: [UserRole.LAB_ADMIN],
      }),
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      session_id: 'session-id',
      session_expires_at: sessionExpiresAt,
    });
  });

  it('should use Administrator as the last name when full name has one part', async () => {
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation(async () => 'hashed-password');

    mockUserRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.save.mockResolvedValue({
      id: 'laboratory-id',
      created_at: createdAt,
    });
    mockUserRepository.save.mockImplementation(async (user: Partial<User>) => ({
      id: 'user-id',
      ...user,
    }));
    mockLaboratoryAdminRepository.save.mockResolvedValue({
      id: 'administrator-id',
      full_name: 'Morenike',
      phone: '+2348098765432',
      is_primary: true,
    });
    mockAuthService.issueAuthSession.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      session_id: 'session-id',
      session_expires_at: sessionExpiresAt,
    });

    await service.setupAdministrator({
      ...payload,
      administrator: {
        ...payload.administrator,
        full_name: 'Morenike',
      },
    });

    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Morenike',
        middle_name: null,
        last_name: 'Administrator',
      }),
    );
  });

  it('should throw a clear conflict when the administrator email belongs to an existing account', async () => {
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation(async () => 'hashed-password');

    mockUserRepository.findOne.mockResolvedValue({ id: 'existing-user-id' });

    await expect(service.setupAdministrator(payload)).rejects.toThrow(
      ConflictException,
    );
    await expect(service.setupAdministrator(payload)).rejects.toThrow(
      sysMsg.LABORATORY_ADMIN_EMAIL_ALREADY_REGISTERED,
    );
    expect(mockLaboratoryRepository.save).not.toHaveBeenCalled();
    expect(mockAuthService.issueAuthSession).not.toHaveBeenCalled();
  });

  it('should throw conflict when registration or license number already exists', async () => {
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation(async () => 'hashed-password');

    mockUserRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.findOne.mockResolvedValue({
      id: 'existing-laboratory-id',
    });

    await expect(service.setupAdministrator(payload)).rejects.toThrow(
      sysMsg.LABORATORY_ALREADY_EXISTS,
    );
    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockAuthService.issueAuthSession).not.toHaveBeenCalled();
  });

  it('should not issue tokens when transactional creation fails', async () => {
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation(async () => 'hashed-password');

    mockUserRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.findOne.mockResolvedValue(null);
    mockLaboratoryRepository.save.mockResolvedValue({
      id: 'laboratory-id',
      created_at: createdAt,
    });
    mockUserRepository.save.mockResolvedValue({
      id: 'user-id',
      role: [UserRole.LAB_ADMIN],
    });
    mockLaboratoryAdminRepository.save.mockRejectedValue(
      new Error('database failure'),
    );

    await expect(service.setupAdministrator(payload)).rejects.toThrow(
      'database failure',
    );
    expect(mockAuthService.issueAuthSession).not.toHaveBeenCalled();
  });
});
