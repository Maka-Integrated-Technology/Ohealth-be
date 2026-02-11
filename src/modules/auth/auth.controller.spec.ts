import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { IRequestWithUser } from '../../common/types';
import * as sysMsg from '../../constants/system.messages';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
    activateUserAccount: jest.fn(),
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
    };
    const expected = { message: sysMsg.ACCOUNT_CREATED };
    mockAuthService.signup.mockResolvedValue(expected);

    const result = await controller.signup(payload);

    expect(authService.signup).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });

  it('should call google login with invite token when provided', async () => {
    const payload = { token: 'google-token', invite_token: 'invite-token' };
    const expected = { message: sysMsg.LOGIN_SUCCESS };
    mockAuthService.googleLogin.mockResolvedValue(expected);

    const result = await controller.googleLogin(payload);

    expect(authService.googleLogin).toHaveBeenCalledWith(
      payload.token,
      payload.invite_token,
    );
    expect(result).toEqual(expected);
  });

  it('should return status and message on account activation', async () => {
    mockAuthService.activateUserAccount.mockResolvedValue(
      sysMsg.USER_ACTIVATED,
    );

    const result = await controller.activateAccount('user-id-1');

    expect(authService.activateUserAccount).toHaveBeenCalledWith('user-id-1');
    expect(result).toEqual({
      status: HttpStatus.OK,
      message: sysMsg.USER_ACTIVATED,
    });
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
    const payload = { email: 'user@example.com', code: '123456' };
    const expected = { message: sysMsg.ACCOUNT_VERIFIED };
    mockAuthService.verifySignup.mockResolvedValue(expected);

    const result = await controller.verifySignup(payload);

    expect(authService.verifySignup).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });
});
