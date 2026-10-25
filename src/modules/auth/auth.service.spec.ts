import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { IRequestWithUser } from '../../common/types';
import * as sysMsg from '../../constants/system.messages';
import { EmailService } from '../email/email.service';
import { ProfessionalVerificationStatus } from '../professional/entities/professional.entity';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { UserService } from '../user/user.service';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { AuthRoutingService } from './auth-routing.service';
import { AuthService } from './auth.service';
import { ResendVerificationDto, VerifySignupDto } from './dto/auth.dto';
import { AuthSession } from './entities/auth.entity';
import { AuthAccessLevel, AuthRoutingTarget } from './enums/auth-routing.enum';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    setPasswordResetChallenge: jest.fn(),
    consumePasswordResetToken: jest.fn(),
    rotateVerificationChallenge: jest.fn(),
    updateAuthenticatedProfile: jest.fn(),
    replaceAuthenticatedPassword: jest.fn(),
    linkGoogleIdentity: jest.fn(),
    verifyEmailWithCode: jest.fn(),
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
          return 'support@ohealth.test';
        case 'mail.from.name':
          return 'OHealth';
        case 'app.name':
          return 'OHealth';
        default:
          return fallback;
      }
    }),
  };

  const mockEmailService = {
    sendMail: jest.fn(),
  };

  const defaultRouting = {
    routing_target: AuthRoutingTarget.PATIENT_HOME,
    access_level: AuthAccessLevel.FULL,
    verification_status: null,
  };

  const mockAuthRoutingService = {
    resolve: jest.fn().mockResolvedValue(defaultRouting),
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
        AccountAccessPolicyService,
        PasswordCredentialsService,
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
          provide: AuthRoutingService,
          useValue: mockAuthRoutingService,
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
    it('creates a pending user with no access, refresh, or session credentials', async () => {
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
        password: 'a memorable patient passphrase',
        role: [UserRole.PATIENT],
      });

      expect(result.message).toBe(sysMsg.VERIFICATION_CODE_SENT);
      expect(result.user.email).toBe('tunde@example.com');
      expect(result).not.toHaveProperty('access_token');
      expect(result).not.toHaveProperty('refresh_token');
      expect(result).not.toHaveProperty('session_id');
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
      expect(mockSessionRepository.save).not.toHaveBeenCalled();
      expect(result).toMatchObject(defaultRouting);
      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: [UserRole.PATIENT] }),
      );
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

    it('should reject privileged and multiple-role signup attempts', async () => {
      await expect(
        service.signup({
          first_name: 'Platform',
          last_name: 'Admin',
          email: 'admin@example.com',
          password: 'Password123',
          role: [UserRole.ADMIN],
        }),
      ).rejects.toThrow(sysMsg.INVALID_SIGNUP_ROLE);

      await expect(
        service.signup({
          first_name: 'Multiple',
          last_name: 'Roles',
          email: 'roles@example.com',
          password: 'Password123',
          role: [UserRole.PATIENT, UserRole.DOCTOR],
        }),
      ).rejects.toThrow(sysMsg.INVALID_SIGNUP_ROLE);

      expect(mockUserService.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('credential login privacy', () => {
    it('uses bcrypt dummy work for an unknown email and returns the same response as a wrong password', async () => {
      const compare = jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(async () => false);

      mockUserService.findByEmail.mockResolvedValueOnce(null);
      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'WrongPass123',
        }),
      ).rejects.toThrow(sysMsg.INVALID_CREDENTIALS);

      mockUserService.findByEmail.mockResolvedValueOnce({
        id: 'known',
        email: 'known@example.com',
        password:
          '$2b$10$Ftuis5NCxsw77LLSIKVzjeUkDSRtIyEo5rbKum.IUIwxXu3agTMjy',
        account_status: AccountStatus.SUSPENDED,
      });
      await expect(
        service.login({ email: 'known@example.com', password: 'WrongPass123' }),
      ).rejects.toThrow(sysMsg.INVALID_CREDENTIALS);

      expect(compare).toHaveBeenCalledTimes(2);
      expect(compare.mock.calls[0][1]).toMatch(/^\$2b\$10\$/);
      expect(compare.mock.calls[1][1]).toMatch(/^\$2b\$10\$/);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(sysMsg.LOGIN_SUCCESS);
    });

    it('does not reveal an inactive account until after correct password comparison', async () => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);
      mockUserService.findByEmail.mockResolvedValue({
        password:
          '$2b$10$Ftuis5NCxsw77LLSIKVzjeUkDSRtIyEo5rbKum.IUIwxXu3agTMjy',
        account_status: AccountStatus.SUSPENDED,
        email_verified_at: new Date(),
      });
      await expect(
        service.login({
          email: 'suspended@example.com',
          password: 'WrongPass123',
        }),
      ).rejects.toThrow(sysMsg.INVALID_CREDENTIALS);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
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

    it('should return the persisted role and resolved routing target', async () => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
      const user = {
        id: 'user-id-1',
        email: 'patient@example.com',
        password:
          '$2b$10$Ftuis5NCxsw77LLSIKVzjeUkDSRtIyEo5rbKum.IUIwxXu3agTMjy',
        first_name: 'Patient',
        last_name: 'User',
        role: [UserRole.PATIENT],
        is_active: true,
        is_verified: true,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      } as User;
      mockUserService.findByEmail.mockResolvedValue(user);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockSessionRepository.create.mockImplementation(
        (payload: Partial<AuthSession>) => payload,
      );
      mockSessionRepository.save.mockImplementation(
        async (payload: Partial<AuthSession>) => payload,
      );

      const result = await service.login({
        email: user.email,
        password: 'Password123',
      });

      expect(result.user.role).toEqual([UserRole.PATIENT]);
      expect(result).toMatchObject(defaultRouting);
      expect(mockAuthRoutingService.resolve).toHaveBeenCalledWith(user);
    });
  });

  it.each([
    AccountStatus.PENDING_VERIFICATION,
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
  ])(
    'denies password login for %s even if legacy flags say active',
    async (accountStatus) => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
      mockUserService.findByEmail.mockResolvedValue({
        id: 'blocked-user',
        email: 'blocked@example.com',
        password: 'hash',
        role: [UserRole.PATIENT],
        account_status: accountStatus,
        email_verified_at: new Date(),
        is_active: true,
        is_verified: true,
      });
      await expect(
        service.login({ email: 'blocked@example.com', password: 'test' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    },
  );

  describe('issueAuthSession', () => {
    it('should issue tokens and create a refresh session for an existing user', async () => {
      const expiresAt = new Date('2026-07-11T16:16:13.000Z');
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(expiresAt.getTime() / 1000),
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

      const result = await service.issueAuthSession({
        id: 'user-id-1',
        email: 'lab.admin@example.com',
        role: [UserRole.LAB_ADMIN],
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      } as User);

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(mockSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: expect.any(String),
          user_id: 'user-id-1',
          refresh_token_hash: expect.any(String),
          revoked_at: null,
        }),
      );
      expect(result).toEqual({
        ...defaultRouting,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        session_id: expect.any(String),
        session_expires_at: expiresAt,
      });
    });
  });

  describe('forgotPassword', () => {
    it('should send otp email when user exists', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        id: 'user-id-1',
        email: 'user@example.com',
        first_name: 'Tunde',
      });
      const result = await service.forgotPassword({
        email: 'user@example.com',
      });

      expect(result.message).toBe(sysMsg.PASSWORD_RESET_CODE_SENT);
      expect(mockUserService.setPasswordResetChallenge).toHaveBeenCalledWith(
        'user-id-1',
        expect.any(String),
        expect.any(Date),
      );
      expect(mockEmailService.sendMail).toHaveBeenCalled();
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

    it('should issue tokens and routing from the current database user', async () => {
      const expiresAt = new Date('2026-07-24T12:00:00.000Z');
      const user = {
        id: 'user-id-1',
        email: 'current@example.com',
        first_name: 'Current',
        last_name: 'User',
        role: [UserRole.DOCTOR],
        is_active: true,
        is_verified: true,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      } as User;
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      mockSessionRepository.findOne.mockResolvedValue({
        user_id: user.id,
        revoked_at: null,
      });
      mockUserService.findById.mockResolvedValue(user);
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(expiresAt.getTime() / 1000),
      });
      mockSessionRepository.save.mockImplementation(
        async (payload: Partial<AuthSession>) => payload,
      );
      mockSessionRepository.create.mockImplementation(
        (payload: Partial<AuthSession>) => payload,
      );
      mockAuthRoutingService.resolve.mockResolvedValueOnce({
        routing_target: AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
        access_level: AuthAccessLevel.LIMITED,
        verification_status: ProfessionalVerificationStatus.PENDING,
      });

      const result = await service.refreshToken({
        refresh_token: 'refresh-token',
      });

      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          email: user.email,
          role: user.role,
        }),
        expect.any(Object),
      );
      expect(result.user.role).toEqual(user.role);
      expect(result.routing_target).toBe(
        AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
      );
    });

    it('should reject a refresh token whose role no longer matches the user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id-1',
        email: 'user@example.com',
        role: [UserRole.ADMIN],
      });
      mockSessionRepository.findOne.mockResolvedValue({
        user_id: 'user-id-1',
        revoked_at: null,
      });
      mockUserService.findById.mockResolvedValue({
        id: 'user-id-1',
        email: 'user@example.com',
        role: [UserRole.PATIENT],
        is_active: true,
        is_verified: true,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      });

      await expect(
        service.refreshToken({ refresh_token: 'refresh-token' }),
      ).rejects.toThrow(sysMsg.TOKEN_INVALID);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  it.each([
    AccountStatus.PENDING_VERIFICATION,
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
  ])(
    'rejects refresh for %s even if legacy flags say active',
    async (accountStatus) => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'blocked-user',
        email: 'blocked@example.com',
        role: [UserRole.PATIENT],
      });
      mockSessionRepository.findOne.mockResolvedValue({
        user_id: 'blocked-user',
        revoked_at: null,
      });
      mockUserService.findById.mockResolvedValue({
        id: 'blocked-user',
        role: [UserRole.PATIENT],
        account_status: accountStatus,
        email_verified_at: new Date(),
        is_active: true,
        is_verified: true,
      });
      await expect(
        service.refreshToken({ refresh_token: 'existing-token' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    },
  );

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

      const result = await service.logout('user-id-1', {
        session_id: 'session-id-1',
      });

      expect(result).toEqual({ message: sysMsg.LOGOUT_SUCCESS });
      expect(mockSessionRepository.save).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.LOGOUT_SUCCESS);
    });

    it('should scope the session lookup to the authenticated caller', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await service.logout('caller-user-id', {
        session_id: 'session-id-1',
      });

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'caller-user-id' }),
        }),
      );
    });

    it('should not revoke anything when the session belongs to another user', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.logout('caller-user-id', {
        session_id: 'session-owned-by-someone-else',
      });

      expect(mockSessionRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual({ message: sysMsg.LOGOUT_SUCCESS });
    });
  });

  describe('resendVerification', () => {
    it('should update code, save user, send email, and return VERIFICATION_CODE_SENT for unverified user', async () => {
      const payload: ResendVerificationDto = { email: 'tunde@example.com' };
      const user = {
        id: 'user-id-1',
        email: payload.email,
        first_name: 'Tunde',
        is_verified: false,
        account_status: AccountStatus.PENDING_VERIFICATION,
        email_verified_at: null,
        verification_code: 'old-code',
        verification_code_expires_at: new Date(Date.now() - 1000),
      };
      mockUserService.rotateVerificationChallenge.mockResolvedValue(user);

      const result = await service.resendVerification(payload);

      expect(result).toEqual({ message: sysMsg.VERIFICATION_CODE_SENT });
      expect(mockUserService.rotateVerificationChallenge).toHaveBeenCalledWith(
        payload.email,
        expect.any(String),
        expect.any(Date),
      );
      expect(mockEmailService.sendMail).toHaveBeenCalled();
    });

    it('should return VERIFICATION_CODE_SENT without sending email for unknown email', async () => {
      mockUserService.rotateVerificationChallenge.mockResolvedValue(null);

      const result = await service.resendVerification({
        email: 'ghost@example.com',
      });

      expect(result).toEqual({ message: sysMsg.VERIFICATION_CODE_SENT });
      expect(mockUserService.rotateVerificationChallenge).toHaveBeenCalled();
      expect(mockEmailService.sendMail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for an already verified user', async () => {
      mockUserService.rotateVerificationChallenge.mockRejectedValue(
        new BadRequestException(sysMsg.ACCOUNT_ALREADY_VERIFIED),
      );

      await expect(
        service.resendVerification({ email: 'verified@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifySignup', () => {
    it('should activate and verify a user with a valid code', async () => {
      const payload: VerifySignupDto = {
        email: 'tunde@example.com',
        code: '123456',
      };
      mockUserService.verifyEmailWithCode.mockResolvedValue({
        id: 'user-id-1',
        email: payload.email,
        first_name: 'Tunde',
        last_name: 'Adebayo',
        role: [UserRole.PATIENT],
        is_active: true,
        is_verified: true,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      });
      mockJwtService.signAsync
        .mockReset()
        .mockResolvedValueOnce('first-access-token')
        .mockResolvedValueOnce('first-refresh-token');
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockSessionRepository.create.mockImplementation(
        (details: Partial<AuthSession>) => details,
      );
      mockSessionRepository.save.mockImplementation(async (details) => details);

      const result = await service.verifySignup(payload);

      expect(result).toMatchObject({
        message: sysMsg.ACCOUNT_VERIFIED,
        access_token: 'first-access-token',
        refresh_token: 'first-refresh-token',
        user: expect.objectContaining({ email: payload.email }),
      });
      expect(mockSessionRepository.save).toHaveBeenCalledTimes(1);
      expect(mockUserService.verifyEmailWithCode).toHaveBeenCalledWith(
        payload.email,
        payload.code,
      );
      expect(mockEmailService.sendMail).toHaveBeenCalled();
    });
  });

  describe('Google OAuth canonical account states', () => {
    beforeEach(() => {
      const ticket = {
        getPayload: () => ({
          email: 'google@example.com',
          sub: 'google-id-1',
          email_verified: true,
          given_name: 'Google',
          family_name: 'Person',
        }),
      } as unknown as LoginTicket;
      jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockImplementation(async () => ticket);
    });

    it.each([
      AccountStatus.PENDING_VERIFICATION,
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
    ])(
      'rejects %s even when legacy flags claim verified',
      async (accountStatus) => {
        mockUserService.findByEmail.mockResolvedValue({
          id: 'blocked-google-user',
          email: 'google@example.com',
          account_status: accountStatus,
          email_verified_at: new Date(),
          is_active: true,
          is_verified: true,
          role: [UserRole.PATIENT],
        });
        await expect(service.googleLogin('google-test-token')).rejects.toThrow(
          UnauthorizedException,
        );
        expect(mockUserService.linkGoogleIdentity).not.toHaveBeenCalled();
        expect(mockJwtService.signAsync).not.toHaveBeenCalled();
        expect(mockSessionRepository.save).not.toHaveBeenCalled();
      },
    );

    it('rejects an active account lacking verification evidence', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        id: 'active-no-proof',
        email: 'google@example.com',
        account_status: AccountStatus.ACTIVE,
        email_verified_at: null,
        is_active: true,
        is_verified: true,
        role: [UserRole.PATIENT],
      });
      await expect(service.googleLogin('google-test-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a mismatched linked Google identity', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        id: 'linked-user',
        email: 'google@example.com',
        google_id: 'another-google-id',
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
        is_active: true,
        is_verified: true,
        role: [UserRole.PATIENT],
      });
      await expect(service.googleLogin('google-test-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserService.linkGoogleIdentity).not.toHaveBeenCalled();
    });

    it('allows a verified active account to receive credentials', async () => {
      const user = {
        id: 'verified-user',
        email: 'google@example.com',
        google_id: 'google-id-1',
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
        is_active: true,
        is_verified: true,
        role: [UserRole.PATIENT],
        first_name: 'Google',
        last_name: 'Person',
      };
      mockUserService.findByEmail.mockResolvedValue(user);
      mockUserService.linkGoogleIdentity.mockResolvedValue(user);
      mockJwtService.signAsync
        .mockReset()
        .mockResolvedValueOnce('oauth-access')
        .mockResolvedValueOnce('oauth-refresh');
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockSessionRepository.create.mockImplementation(
        (details: Partial<AuthSession>) => details,
      );
      mockSessionRepository.save.mockImplementation(async (details) => details);

      const response = await service.googleLogin('google-test-token');
      expect(response.access_token).toBe('oauth-access');
      expect(response.refresh_token).toBe('oauth-refresh');
      expect(mockSessionRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
