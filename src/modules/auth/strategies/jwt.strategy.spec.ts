import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as sysMsg from '../../../constants/system.messages';
import { UserRole } from '../../user/enums/user-role.enum';
import { RefreshSessionService } from '../sessions/refresh-session.service';

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'a'.repeat(32);
      if (key === 'TOKEN_ACCESS_DURATION') return '15m';
      if (key === 'TOKEN_REFRESH_DURATION') return '7d';
      return undefined;
    }),
  };
  const sessions = { validate: jest.fn() };
  const strategy = new JwtStrategy(
    configService as unknown as ConfigService,
    sessions as unknown as RefreshSessionService,
  );
  const payload = {
    sub: '550e8400-e29b-41d4-a716-446655440000',
    sid: '550e8400-e29b-41d4-a716-446655440001',
    jti: '550e8400-e29b-41d4-a716-446655440002',
    iat: 1000,
    exp: 1900,
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns current database identity and binds it to the token session', async () => {
    sessions.validate.mockResolvedValue({
      id: payload.sub,
      email: 'current@example.com',
      role: [UserRole.DOCTOR],
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: payload.sub,
      userId: payload.sub,
      email: 'current@example.com',
      roles: [UserRole.DOCTOR],
      sessionId: payload.sid,
    });
    expect(sessions.validate).toHaveBeenCalledWith(payload.sub, payload.sid);
  });

  it.each([
    { ...payload, sid: 'not-a-uuid' },
    { ...payload, jti: 'not-a-uuid' },
    { ...payload, exp: payload.iat },
    { ...payload, exp: payload.iat + 901 },
  ])('rejects malformed or overlong access-token claims', async (claims) => {
    await expect(strategy.validate(claims)).rejects.toThrow(
      sysMsg.TOKEN_INVALID,
    );
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('propagates revoked-session rejection', async () => {
    sessions.validate.mockRejectedValue(new UnauthorizedException());
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
