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
import { EmailService } from '../email/email.service';
import { CanonicalPatientProfileService } from '../patient/personal-profile/canonical-patient-profile.service';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { UserService } from '../user/user.service';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { AuthService } from './auth.service';
import { AuthChallengeDeliveryService } from './challenges/auth-challenge-delivery.service';
import { SecureAuthChallengeFlowsService } from './challenges/secure-auth-challenge-flows.service';
import { AuthContextService } from './context/auth-context.service';
import { VerifySignupDto } from './dto/auth.dto';
import { AuthSession } from './entities/auth.entity';
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
    resendContact: jest.fn(),
    resendRecovery: jest.fn(),
    requestLogin: jest.fn(),
    verifyLogin: jest.fn(),
    resendLogin: jest.fn(),
    rejectLoginAttempt: jest.fn(),
  };
  const mockChallengeDelivery = { queueInTransaction: jest.fn() };
  const mockRegistration = { register: jest.fn() };
  const mockPatientProfiles = { update: jest.fn() };
  const mockSessions = {
    issue: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeByCredential: jest.fn(),
    revokeAll: jest.fn(),
    replacePassword: jest.fn(),
    list: jest.fn(),
  };

  const mockAuthContextService = {
    resolve: jest.fn().mockResolvedValue({
      account: { id: 'user-id-1' },
      personas: [],
      professional: null,
      memberships: [],
      capabilities: [],
      session: { id: 'session-id-1' },
    }),
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
          provide: CanonicalPatientProfileService,
          useValue: mockPatientProfiles,
        },
        {
          provide: AuthContextService,
          useValue: mockAuthContextService,
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
      message: 'Verification code queued',
      challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
      delivery_target: 't***@example.com',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    });
    mockChallengeFlows.requestRecovery.mockResolvedValue({
      message:
        'If this account is eligible, a verification message has been queued.',
    });
    mockChallengeFlows.resendContact.mockResolvedValue({
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
      message: 'Verification code queued',
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

      expect(result.message).toBe('Verification code queued');
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
        message: 'Verification code queued',
        challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
        resend_after_seconds: 60,
        expires_in_seconds: 600,
      });
      expect(mockChallengeFlows.requestLogin).toHaveBeenCalledWith(user);
      expect(mockSessions.issue).not.toHaveBeenCalled();
    });

    it('rejects password login when password authentication is disabled', async () => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
      mockUserService.findByEmail.mockResolvedValue({
        id: 'google-only-user',
        email: 'google-only@example.com',
        password: '$2b$10$placeholder',
        password_authentication_enabled: false,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      });

      await expect(
        service.login({
          email: 'google-only@example.com',
          password: 'attacker supplied password',
        }),
      ).rejects.toThrow(sysMsg.INVALID_CREDENTIALS);
      expect(mockChallengeFlows.requestLogin).not.toHaveBeenCalled();
      expect(mockSessions.issue).not.toHaveBeenCalled();
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
        account_context: expect.any(Object),
      });
      expect(mockAuthContextService.resolve).toHaveBeenCalledWith(
        user.id,
        '550e8400-e29b-41d4-a716-446655440000',
      );
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
        account_context: expect.any(Object),
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

    it('should issue tokens and canonical context from the current database user', async () => {
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
      const context = { account: { id: user.id }, capabilities: [] };
      mockAuthContextService.resolve.mockResolvedValueOnce(context);

      const result = await service.refreshToken({
        refresh_token: 'refresh-token',
      });

      expect(mockSessions.rotate).toHaveBeenCalledWith('refresh-token');
      expect(result.account_context).toEqual(context);
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
          sessionId: 'session-id-1',
        },
      } as IRequestWithUser;

      const result = await service.getProfile(req);

      expect(result).toEqual(
        await mockAuthContextService.resolve.mock.results[
          mockAuthContextService.resolve.mock.results.length - 1
        ].value,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates only the current session patient and returns refreshed canonical context', async () => {
      const request = {
        user: { id: 'user-id-1', sessionId: 'session-id-1' },
      } as IRequestWithUser;
      const update = { first_name: 'Amaka', address: 'New Street' };

      await service.updateProfile(request, update);

      expect(mockPatientProfiles.update).toHaveBeenCalledWith(
        'user-id-1',
        'session-id-1',
        update,
      );
      expect(mockAuthContextService.resolve).toHaveBeenCalledWith(
        'user-id-1',
        'session-id-1',
      );
    });

    it('rejects a request without canonical session identity', async () => {
      await expect(
        service.updateProfile(
          { user: { id: 'user-id-1' } } as IRequestWithUser,
          {
            first_name: 'Amaka',
          },
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPatientProfiles.update).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes a browser session by its canonical refresh credential', async () => {
      const result = await service.logoutByRefreshCredential('r'.repeat(43));

      expect(mockSessions.revokeByCredential).toHaveBeenCalledWith(
        'r'.repeat(43),
      );
      expect(result).toEqual({ message: sysMsg.LOGOUT_SUCCESS });
      expect(mockLogger.info).toHaveBeenCalledWith(sysMsg.LOGOUT_SUCCESS);
    });

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
    it('delegates with the opaque continuation handle', async () => {
      const challengeId = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
      const result = await service.resendVerification({
        challenge_id: challengeId,
      });
      expect(result.message).toContain('queued');
      expect(mockChallengeFlows.resendContact).toHaveBeenCalledWith(
        challengeId,
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
        account_context: expect.any(Object),
      });
      expect(mockSessions.issue).not.toHaveBeenCalled();
      expect(mockChallengeFlows.verifyContact).toHaveBeenCalledWith(
        payload.challenge_id,
        payload.code,
      );
      expect(mockEmailService.sendMail).toHaveBeenCalled();
    });
  });

  describe('legacy Google login containment', () => {
    it('requires the nonce-bound transaction flow', () => {
      expect(() => service.googleLogin('legacy-google-token')).toThrow(
        expect.objectContaining({ errorCode: 'OAUTH_TRANSACTION_REQUIRED' }),
      );
      expect(mockUserService.findByEmail).not.toHaveBeenCalled();
      expect(mockUserService.linkGoogleIdentity).not.toHaveBeenCalled();
      expect(mockSessions.issue).not.toHaveBeenCalled();
    });
  });
});
