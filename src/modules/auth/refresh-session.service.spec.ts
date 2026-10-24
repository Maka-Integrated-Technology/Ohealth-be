import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { RefreshSessionService } from './refresh-session.service';

describe('Refresh session configuration boundary', () => {
  const valid = {
    ['JWT_SECRET']: 'a'.repeat(32),
    ['TOKEN_ACCESS_DURATION']: '15m',
    ['TOKEN_REFRESH_DURATION']: '7d',
  };
  const create = (values: Record<string, string>) =>
    new RefreshSessionService(
      {} as DataSource,
      new JwtService(),
      new ConfigService(values),
      new AccountAccessPolicyService(),
    );

  it('accepts explicit bounded configuration', () => {
    expect(() => create(valid)).not.toThrow();
  });

  it.each(['JWT_SECRET', 'TOKEN_ACCESS_DURATION', 'TOKEN_REFRESH_DURATION'])(
    'rejects missing %s rather than substituting defaults',
    (key) => {
      const values = { ...valid };
      delete values[key];
      expect(() => create(values)).toThrow();
    },
  );

  it.each(['change_me', '', ' '.repeat(32)])(
    'rejects a weak signing secret',
    (value) => {
      expect(() => create({ ...valid, ['JWT_SECRET']: value })).toThrow(
        'JWT_SECRET',
      );
    },
  );

  it.each(['0', '-1', 'forever', '16m', '900000000000000000000s'])(
    'rejects unsafe access lifetime %s',
    (value) => {
      expect(() =>
        create({ ...valid, ['TOKEN_ACCESS_DURATION']: value }),
      ).toThrow('TOKEN_ACCESS_DURATION');
    },
  );

  it('bounds absolute refresh lifetime to 30 days', () => {
    expect(() =>
      create({ ...valid, ['TOKEN_REFRESH_DURATION']: '31d' }),
    ).toThrow('TOKEN_REFRESH_DURATION');
  });
});
