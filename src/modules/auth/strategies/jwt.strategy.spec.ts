import { randomUUID } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RefreshSessionService } from '../refresh-session.service';

import { JwtStrategy } from './jwt.strategy';

describe('Session-bound JwtStrategy', () => {
  const sessions = { validate: jest.fn() };
  const strategy = new JwtStrategy(
    new ConfigService({
      ['JWT_SECRET']: 'a'.repeat(32),
      ['TOKEN_ACCESS_DURATION']: '15m',
      ['TOKEN_REFRESH_DURATION']: '7d',
    }),
    sessions as unknown as RefreshSessionService,
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: randomUUID(),
    sid: randomUUID(),
    jti: randomUUID(),
    iat: now,
    exp: now + 900,
  };
  beforeEach(() => jest.resetAllMocks());

  it('resolves identity and roles from the current persisted session', async () => {
    sessions.validate.mockResolvedValue({
      id: payload.sub,
      email: 'current@example.test',
      role: ['PATIENT'],
    });
    expect(await strategy.validate(payload)).toEqual({
      id: payload.sub,
      userId: payload.sub,
      sessionId: payload.sid,
      email: 'current@example.test',
      roles: ['PATIENT'],
    });
    expect(sessions.validate).toHaveBeenCalledWith(payload.sub, payload.sid);
  });

  it.each([
    {},
    { sub: payload.sub },
    { ...payload, sid: 'bad' },
    { ...payload, jti: undefined },
    { ...payload, exp: undefined },
    { ...payload, exp: payload.iat + 901 },
    { ...payload, exp: payload.iat },
  ])(
    'rejects legacy or malformed claims before querying the database',
    async (invalid) => {
      await expect(strategy.validate(invalid)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessions.validate).not.toHaveBeenCalled();
    },
  );

  it('propagates revocation and account-policy denial', async () => {
    sessions.validate.mockRejectedValue(new UnauthorizedException());
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
