import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as sysMsg from '../../../constants/system.messages';
import { UserRole } from '../../user/enums/user-role.enum';
import { UserService } from '../../user/user.service';

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    get: jest.fn().mockReturnValue('access-secret'),
  };
  const userService = { findById: jest.fn() };
  const strategy = new JwtStrategy(
    configService as unknown as ConfigService,
    userService as unknown as UserService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('uses the current database identity and roles', async () => {
    userService.findById.mockResolvedValue({
      id: 'user-id',
      email: 'current@example.com',
      role: [UserRole.DOCTOR, UserRole.COUNSELLOR],
      is_active: true,
      is_verified: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'token@example.com',
        role: [UserRole.COUNSELLOR, UserRole.DOCTOR],
      }),
    ).resolves.toEqual({
      id: 'user-id',
      userId: 'user-id',
      email: 'current@example.com',
      roles: [UserRole.DOCTOR, UserRole.COUNSELLOR],
    });
  });

  it('rejects a token when its embedded role no longer matches the user', async () => {
    userService.findById.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      role: [UserRole.PATIENT],
      is_active: true,
      is_verified: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'user@example.com',
        role: [UserRole.ADMIN],
      }),
    ).rejects.toThrow(sysMsg.TOKEN_INVALID);
  });

  it('rejects inactive or unverified database users', async () => {
    userService.findById.mockResolvedValue({
      id: 'user-id',
      role: [UserRole.PATIENT],
      is_active: false,
      is_verified: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'user@example.com',
        role: [UserRole.PATIENT],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
