import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
import { AuthChallengeDeliveryService } from './challenges/auth-challenge-delivery.service';
import { SecureAuthChallengeFlowsService } from './challenges/secure-auth-challenge-flows.service';
import { VerifySignupDto } from './dto/auth.dto';
import { AuthSession } from './entities/auth.entity';
import { AuthAccessLevel, AuthRoutingTarget } from './enums/auth-routing.enum';
import { SignupIntent } from './enums/signup-intent.enum';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { RegistrationService } from './registration/registration.service';
import { RefreshSessionService } from './sessions/refresh-session.service';

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
  const mockChallengeFlows = {
    requestRecovery: jest.fn(),
    completeRecovery: jest.fn(),
    verifyContact: jest.fn(),
    resend: jest.fn(),
    requestLogin: jest.fn(),
    verifyLogin: jest.fn(),
    resendLogin: jest.fn(),
    rejectLoginAttempt: jest.fn(),
  };
  const mockChallengeDelivery = { queueInTransaction: jest.fn() };
  const mockRegistration = { register: jest.fn() };
  const mockSessions = {
    issue: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
    replacePassword: jest.fn(),
    list: jest.fn(),
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
          provide: SecureAuthChallengeFlowsService,
          useValue: mockChallengeFlows,
        },
        {
          provide: AuthChallengeDeliveryService,
          useValue: mockChallengeDelivery,
        },
        {
          provide: RefreshSessionService,
          useValue: mockSessions,
        },
        {
          provide: RegistrationService,
          useValue: mockRegistration,
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
    mockRegistration.register.mockResolvedValue({
      message: 'Verification queued',
      challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
      delivery_target: 't***@example.com',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    });
    mockChallengeFlows.requestRecovery.mockResolvedValue({
      message:
        'If this account is eligible, a verification message has been queued.',
    });
    mockChallengeFlows.resend.mockResolvedValue({
      message:
        'If this account is eligible, a verification message has been queued.',
    });
    mockSessions.issue.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      session_expires_at: new Date('2026-07-11T16:16:13.000Z'),
    });
    mockChallengeFlows.requestLogin.mockResolvedValue({
      message: 'Login verification queued',
      challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    });
    mockChallengeFlows.rejectLoginAttempt.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('creates a pending user with no access, refresh, or session credentials', async () => {
      const payload = {
        first_name: 'Tunde',
        last_name: 'Adebayo',
        email: 'tunde@example.com',
        password: 'a memorable patient passphrase',
        intent: SignupIntent.PATIENT,
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
      };
      const result = await service.signup(payload, 'request-key', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.message).toBe('Verification queued');
      expect(result).not.toHaveProperty('access_token');
      expect(result).not.toHaveProperty('refresh_token');
      expect(result).not.toHaveProperty('session_id');
      expect(mockRegistration.register).toHaveBeenCalledWith(
        payload,
        'request-key',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
      );
      expect(result.challenge_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.ACCOUNT_CREATED);
    });

    it('should throw conflict exception for duplicate email', async () => {
      mockRegistration.register.mockRejectedValueOnce(
        new ConflictException(sysMsg.ACCOUNT_ALREADY_EXISTS),
      );
      await expect(
        service.signup({
          first_name: 'Grace',
          last_name: 'Okeke',
          email: 'grace@example.com',
          password: 'a strong registration passphrase',
          intent: SignupIntent.PATIENT,
          accepted_terms_version: 'terms-v1',
          accepted_privacy_version: 'privacy-v1',
        }),
      ).rejects.toThrow(ConflictException);
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

    it('queues a login challenge without issuing credentials', async () => {
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

      expect(result).toEqual({
        message: 'Login verification queued',
        challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
        resend_after_seconds: 60,
        expires_in_seconds: 600,
      });
      expect(mockChallengeFlows.requestLogin).toHaveBeenCalledWith(user);
      expect(mockSessions.issue).not.toHaveBeenCalled();
      expect(mockAuthRoutingService.resolve).not.toHaveBeenCalled();
    });

    it('returns credentials only after the login challenge is consumed', async () => {
      const user = {
        id: 'user-id-1',
        email: 'patient@example.com',
        first_name: 'Patient',
        last_name: 'User',
        role: [UserRole.PATIENT],
      } as User;
      mockChallengeFlows.verifyLogin.mockResolvedValue({
        user,
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          session_id: '550e8400-e29b-41d4-a716-446655440000',
          session_expires_at: new Date('2026-07-11T16:16:13.000Z'),
        },
      });

      const result = await service.verifyLogin({
        challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
        code: '123456',
      });

      expect(result).toMatchObject({
        message: sysMsg.LOGIN_SUCCESS,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: { id: user.id },
      });
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

      expect(mockSessions.issue).toHaveBeenCalledWith('user-id-1', undefined);
      expect(result).toEqual({
        ...defaultRouting,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        session_expires_at: expiresAt,
      });
    });
  });

  describe('forgotPassword', () => {
    it('returns a generic queued response without writing legacy reset tokens', async () => {
      const result = await service.forgotPassword({
        email: 'user@example.com',
      });
      expect(result.message).toContain('queued');
      expect(mockChallengeFlows.requestRecovery).toHaveBeenCalledWith(
        'user@example.com',
      );
      expect(mockUserService.setPasswordResetChallenge).not.toHaveBeenCalled();
      expect(mockEmailService.sendMail).not.toHaveBeenCalled();
    });

    it('uses a purpose-bound challenge to reset without legacy token lookup', async () => {
      mockChallengeFlows.completeRecovery.mockResolvedValue(undefined);
      await expect(
        service.resetPassword({
          challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
          code: '123456',
          newPassword: 'a memorable replacement passphrase',
        }),
      ).resolves.toEqual({ message: sysMsg.PASSWORD_RESET_SUCCESS });
      expect(mockChallengeFlows.completeRecovery).toHaveBeenCalledWith(
        'f64031c5-70e4-4b37-a92c-f193e59a6621',
        '123456',
        expect.any(String),
      );
      expect(mockUserService.consumePasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should throw unauthorized exception when the session is missing', async () => {
      mockSessions.rotate.mockRejectedValueOnce(
        new UnauthorizedException(sysMsg.TOKEN_INVALID),
      );

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
      mockSessions.rotate.mockResolvedValueOnce({
        userId: user.id,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        session_expires_at: expiresAt,
      });
      mockUserService.findById.mockResolvedValue(user);
      mockAuthRoutingService.resolve.mockResolvedValueOnce({
        routing_target: AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
        access_level: AuthAccessLevel.LIMITED,
        verification_status: ProfessionalVerificationStatus.PENDING,
      });

      const result = await service.refreshToken({
        refresh_token: 'refresh-token',
      });

      expect(mockSessions.rotate).toHaveBeenCalledWith('refresh-token');
      expect(result.user.role).toEqual(user.role);
      expect(result.routing_target).toBe(
        AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
      );
    });
  });

  it.each([
    AccountStatus.PENDING_VERIFICATION,
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
  ])(
    'rejects refresh for %s even if legacy flags say active',
    async (accountStatus) => {
      mockSessions.rotate.mockResolvedValueOnce({
        userId: 'blocked-user',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        session_expires_at: new Date(),
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
      expect(mockSessions.rotate).toHaveBeenCalled();
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
      expect(mockSessions.revoke).toHaveBeenCalledWith(
        'user-id-1',
        'session-id-1',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.LOGOUT_SUCCESS);
    });

    it('should scope the session lookup to the authenticated caller', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await service.logout('caller-user-id', {
        session_id: 'session-id-1',
      });

      expect(mockSessions.revoke).toHaveBeenCalledWith(
        'caller-user-id',
        'session-id-1',
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
    it('delegates to the secure challenge flow for pending or unknown accounts', async () => {
      const result = await service.resendVerification({
        email: 'tunde@example.com',
      });
      expect(result.message).toContain('queued');
      expect(mockChallengeFlows.resend).toHaveBeenCalledWith(
        'tunde@example.com',
      );
      expect(
        mockUserService.rotateVerificationChallenge,
      ).not.toHaveBeenCalled();
      expect(mockEmailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('verifySignup', () => {
    it('should activate and verify a user with a valid code', async () => {
      const payload: VerifySignupDto = {
        challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
        code: '123456',
      };
      mockChallengeFlows.verifyContact.mockResolvedValue({
        user: {
          id: 'user-id-1',
          email: 'tunde@example.com',
          first_name: 'Tunde',
          last_name: 'Adebayo',
          role: [UserRole.PATIENT],
          is_active: true,
          is_verified: true,
          account_status: AccountStatus.ACTIVE,
          email_verified_at: new Date(),
        },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          session_id: '550e8400-e29b-41d4-a716-446655440000',
          session_expires_at: new Date('2026-07-11T16:16:13.000Z'),
        },
      });

      const result = await service.verifySignup(payload);

      expect(result).toMatchObject({
        message: sysMsg.ACCOUNT_VERIFIED,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: expect.objectContaining({ email: 'tunde@example.com' }),
      });
      expect(mockSessions.issue).not.toHaveBeenCalled();
      expect(mockChallengeFlows.verifyContact).toHaveBeenCalledWith(
        payload.challenge_id,
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
      expect(response.access_token).toBe('access-token');
      expect(response.refresh_token).toBe('refresh-token');
      expect(mockSessions.issue).toHaveBeenCalledTimes(1);
    });
  });
});
