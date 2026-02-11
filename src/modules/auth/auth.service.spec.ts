import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { IRequestWithUser } from '../../common/types';
import * as sysMsg from '../../constants/system.messages';
import { UserRole } from '../user/enums/user-role.enum';
import { UserService } from '../user/user.service';
import { EmailService } from '../email/email.service';
import { VerifySignupDto } from './dto/auth.dto';

import { AuthService } from './auth.service';
import { AuthSession } from './entities/auth.entity';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByResetToken: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => {
      switch (key) {
        case 'HASH_SALT':
          return '10';
        case 'JWT_SECRET':
          return 'access-secret';
        case 'JWT_REFRESH_SECRET':
          return 'refresh-secret';
        case 'TOKEN_ACCESS_DURATION':
          return '15m';
        case 'TOKEN_REFRESH_DURATION':
          return '7d';
        case 'GOOGLE_CLIENT_ID':
          return 'google-client-id';
        case 'mail.from.address':
          return 'support@healthbridge.test';
        case 'mail.from.name':
          return 'HealthBridge';
        case 'app.name':
          return 'HealthBridge';
        default:
          return fallback;
      }
    }),
  };

  const mockEmailService = {
    sendMail: jest.fn(),
  };

  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: mockSessionRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('should create a user, issue tokens, and open a session', async () => {
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(async () => 'hashed-password');

      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockImplementation(
        (payload: Record<string, unknown>) => ({
          id: 'user-id-1',
          ...payload,
        }),
      );
      mockUserService.save.mockImplementation(
        async (payload: Record<string, unknown>) => payload,
      );

      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockSessionRepository.create.mockImplementation(
        (payload: Partial<AuthSession>) => ({
          id: 'session-db-id',
          ...payload,
        }),
      );
      mockSessionRepository.save.mockImplementation(
        async (payload: Partial<AuthSession>) => payload,
      );

      const result = await service.signup({
        first_name: 'Tunde',
        last_name: 'Adebayo',
        email: 'tunde@example.com',
        password: 'Password123',
        role: [UserRole.PATIENT],
      });

      expect(result.message).toBe(sysMsg.VERIFICATION_CODE_SENT);
      expect(result.user.email).toBe('tunde@example.com');
      expect(result).toHaveProperty('access_token', 'access-token');
      expect(result).toHaveProperty('refresh_token', 'refresh-token');
      expect(result).toHaveProperty('session_id');
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.ACCOUNT_CREATED);
      expect(mockEmailService.sendMail).toHaveBeenCalled();
    });

    it('should throw conflict exception for duplicate email', async () => {
      mockUserService.findByEmail.mockResolvedValue({ id: 'existing-user-id' });

      await expect(
        service.signup({
          first_name: 'Grace',
          last_name: 'Okeke',
          email: 'grace@example.com',
          password: 'Password123',
          role: [UserRole.PATIENT],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw unauthorized exception for invalid credentials', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'wrong-pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should throw unauthorized exception when the session is missing', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id-1',
        email: 'user@example.com',
        role: [UserRole.PATIENT],
      });
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refreshToken({
          refresh_token: 'refresh-token',
        }),
      ).rejects.toThrow(sysMsg.TOKEN_INVALID);
    });
  });

  describe('getProfile', () => {
    it('should return the authenticated user profile', async () => {
      mockUserService.findById.mockResolvedValue({
        id: 'user-id-1',
        email: 'funke@example.com',
        first_name: 'Funke',
        last_name: 'Ibrahim',
        middle_name: null,
        role: [UserRole.PATIENT],
        gender: 'Female',
        dob: '2001-01-10',
        phone: '+2348000000000',
        is_active: true,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-10'),
      });

      const req = {
        user: {
          id: 'user-id-1',
          userId: 'user-id-1',
          email: 'funke@example.com',
          roles: [UserRole.PATIENT],
        },
      } as IRequestWithUser;

      const result = await service.getProfile(req);

      expect(result.id).toBe('user-id-1');
      expect(result.email).toBe('funke@example.com');
      expect(result.role).toEqual([UserRole.PATIENT]);
    });
  });

  describe('logout', () => {
    it('should revoke active session and return success message', async () => {
      mockSessionRepository.findOne.mockResolvedValue({
        id: 'session-db-id',
        session_id: 'session-id-1',
        user_id: 'user-id-1',
        revoked_at: null,
      });
      mockSessionRepository.save.mockImplementation(
        async (payload: Partial<AuthSession>) => payload,
      );

      const result = await service.logout({
        user_id: 'user-id-1',
        session_id: 'session-id-1',
      });

      expect(result).toEqual({ message: sysMsg.LOGOUT_SUCCESS });
      expect(mockSessionRepository.save).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.LOGOUT_SUCCESS);
    });
  });

  describe('verifySignup', () => {
    it('should activate and verify a user with a valid code', async () => {
      const payload: VerifySignupDto = {
        email: 'tunde@example.com',
        code: '123456',
      };
      mockUserService.findByEmail.mockResolvedValue({
        id: 'user-id-1',
        email: payload.email,
        first_name: 'Tunde',
        last_name: 'Adebayo',
        is_active: false,
        is_verified: false,
        verification_code: '123456',
        verification_code_expires_at: new Date(Date.now() + 60000),
      });
      mockUserService.save.mockImplementation(async (u: Record<string, unknown>) => u);

      const result = await service.verifySignup(payload);

      expect(result).toEqual({ message: sysMsg.ACCOUNT_VERIFIED });
      expect(mockUserService.save).toHaveBeenCalled();
      expect(mockEmailService.sendMail).toHaveBeenCalled();
    });
  });
});
