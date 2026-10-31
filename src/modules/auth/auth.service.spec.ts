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
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { RefreshSessionService } from './refresh-session.service';

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

  const sessionTokens = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    session_id: 'session-id-1',
    session_expires_at: new Date('2026-07-11T16:16:13.000Z'),
  };
  const mockSessions = {
    issue: jest.fn(),
    rotate: jest.fn(),
    validate: jest.fn(),
    revoke: jest.fn(),
    replacePassword: jest.fn(),
    list: jest.fn(),
    revokeAll: jest.fn(),
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
    signup: jest.fn(),
    requestRecovery: jest.fn(),
    completeRecovery: jest.fn(),
    verifyContact: jest.fn(),
    resend: jest.fn(),
  };
  const mockChallengeDelivery = { queueInTransaction: jest.fn() };

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
        { provide: RefreshSessionService, useValue: mockSessions },
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
    mockSessions.issue.mockReset().mockResolvedValue(sessionTokens);
    mockSessions.rotate.mockReset();
    mockSessions.validate.mockReset();
    mockChallengeFlows.signup.mockResolvedValue({
      user: {
        id: 'user-id-1',
        email: 'tunde@example.com',
        first_name: 'Tunde',
        last_name: 'Adebayo',
        role: [UserRole.PATIENT],
      },
      challengeId: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
    });
    mockChallengeFlows.requestRecovery.mockResolvedValue({
      message:
        'If this account is eligible, a verification message has been queued.',
    });
    mockChallengeFlows.resend.mockResolvedValue({
      message:
        'If this account is eligible, a verification message has been queued.',
    });
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

      expect(result.message).toBe('Verification queued');
      expect(result.user.email).toBe('tunde@example.com');
      expect(result).not.toHaveProperty('access_token');
      expect(result).not.toHaveProperty('refresh_token');
      expect(result).not.toHaveProperty('session_id');
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
      expect(mockSessionRepository.save).not.toHaveBeenCalled();
      expect(result).toMatchObject(defaultRouting);
      expect(mockChallengeFlows.signup).toHaveBeenCalledWith(
        expect.objectContaining({ role: [UserRole.PATIENT] }),
        expect.any(String),
      );
      expect(result.challenge_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.ACCOUNT_CREATED);
      expect(mockEmailService.sendMail).not.toHaveBeenCalled();
    });

    it('should throw conflict exception for duplicate email', async () => {
      mockChallengeFlows.signup.mockRejectedValueOnce(
        new ConflictException(sysMsg.ACCOUNT_ALREADY_EXISTS),
      );
      await expect(
        service.signup({
          first_name: 'Grace',
          last_name: 'Okeke',
          email: 'grace@example.com',
          password: 'a strong registration passphrase',
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
        password: 'credential-snapshot',
        role: [UserRole.LAB_ADMIN],
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      } as User);

      expect(mockSessions.issue).toHaveBeenCalledWith(
        'user-id-1',
        'credential-snapshot',
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
    it('propagates rejection from canonical rotation', async () => {
      mockSessions.rotate.mockRejectedValue(
        new UnauthorizedException(sysMsg.TOKEN_INVALID),
      );
      await expect(
        service.refreshToken({ refresh_token: 'invalid' }),
      ).rejects.toThrow(sysMsg.TOKEN_INVALID);
    });
    it('uses current database roles and never returns the internal owner identifier', async () => {
      const user = {
        id: 'user-id-1',
        email: 'current@example.com',
        role: [UserRole.DOCTOR],
      };
      mockSessions.rotate.mockResolvedValue({
        ...sessionTokens,
        userId: user.id,
      });
      mockSessions.validate.mockResolvedValue(user);
      const result = await service.refreshToken({
        refresh_token: sessionTokens.refresh_token,
      });
      expect(mockSessions.rotate).toHaveBeenCalledWith(
        sessionTokens.refresh_token,
      );
      expect(result.user.role).toEqual(user.role);
      expect(result).not.toHaveProperty('userId');
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
    it('passes authenticated ownership to canonical revocation', async () => {
      const result = await service.logout('caller', { session_id: 'target' });
      expect(mockSessions.revoke).toHaveBeenCalledWith('caller', 'target');
      expect(result).toEqual({ message: sysMsg.LOGOUT_SUCCESS });
    });
    it('rejects logout targeting a different session from the bearer session', async () => {
      await expect(
        service.logout('caller', { session_id: 'other' }, 'current'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockSessions.revoke).not.toHaveBeenCalled();
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
        id: 'user-id-1',
        email: 'tunde@example.com',
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
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: expect.objectContaining({ email: 'tunde@example.com' }),
      });
      expect(mockSessions.issue).toHaveBeenCalledTimes(1);
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
