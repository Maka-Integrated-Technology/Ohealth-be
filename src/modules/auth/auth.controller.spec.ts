import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { IRequestWithUser } from '../../common/types';
import * as sysMsg from '../../constants/system.messages';
import { UserRole } from '../user/enums/user-role.enum';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAbuseGuard } from './challenges/auth-abuse.guard';
import { AuthRateLimitService } from './challenges/auth-rate-limit.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    googleLogin: jest.fn(),
    refreshToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifySignup: jest.fn(),
    resendVerification: jest.fn(),
    getProfile: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AuthAbuseGuard,
          useValue: { canActivate: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: AuthRateLimitService,
          useValue: {
            consume: jest.fn().mockResolvedValue({
              allowed: true,
              hits: 1,
              retryAfterSeconds: 0,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call signup on auth service', async () => {
    const payload = {
      first_name: 'Grace',
      last_name: 'Okeke',
      email: 'grace@example.com',
      password: 'Password123',
      role: [UserRole.PATIENT],
    };
    const expected = { message: sysMsg.ACCOUNT_CREATED };
    mockAuthService.signup.mockResolvedValue(expected);

    const result = await controller.signup(payload);

    expect(authService.signup).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });

  it('permanently denies the deprecated account activation command', () => {
    expect(() => controller.activateAccount()).toThrow(ForbiddenException);
  });

  it('should return profile for authenticated request', async () => {
    const request = {
      user: {
        id: 'user-id-1',
        userId: 'user-id-1',
        email: 'tunde@example.com',
        roles: ['PATIENT'],
      },
    } as IRequestWithUser;
    const expected = {
      id: 'user-id-1',
      email: 'tunde@example.com',
      first_name: 'Tunde',
      last_name: 'Adebayo',
    };
    mockAuthService.getProfile.mockResolvedValue(expected);

    const result = await controller.getProfile(request);

    expect(authService.getProfile).toHaveBeenCalledWith(request);
    expect(result).toEqual(expected);
  });

  it('should verify signup code', async () => {
    const payload = {
      challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
      code: '123456',
    };
    const expected = { message: sysMsg.ACCOUNT_VERIFIED };
    mockAuthService.verifySignup.mockResolvedValue(expected);

    const result = await controller.verifySignup(payload);

    expect(authService.verifySignup).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });

  it('should call resendVerification on auth service', async () => {
    const payload = { email: 'user@example.com' };
    const expected = { message: sysMsg.VERIFICATION_CODE_SENT };
    mockAuthService.resendVerification.mockResolvedValue(expected);

    const result = await controller.resendVerification(payload);

    expect(authService.resendVerification).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });
});
