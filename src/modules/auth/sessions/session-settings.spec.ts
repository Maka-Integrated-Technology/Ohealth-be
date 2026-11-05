/* eslint-disable @typescript-eslint/naming-convention */
import { ConfigService } from '@nestjs/config';

import { sessionSettings } from './session-settings';

describe('sessionSettings', () => {
  const valid = {
    JWT_SECRET: 'a'.repeat(32),
    TOKEN_ACCESS_DURATION: '15m',
    TOKEN_REFRESH_DURATION: '30d',
  };

  it('requires an explicit strong secret and bounded durations', () => {
    expect(sessionSettings(new ConfigService(valid))).toEqual({
      jwtSecret: valid.JWT_SECRET,
      accessDurationSeconds: 900,
      refreshDurationSeconds: 2_592_000,
    });
  });

  it.each([
    { ...valid, JWT_SECRET: 'short' },
    { ...valid, TOKEN_ACCESS_DURATION: '901s' },
    { ...valid, TOKEN_ACCESS_DURATION: '15M' },
    { ...valid, TOKEN_REFRESH_DURATION: '31d' },
    { ...valid, TOKEN_REFRESH_DURATION: '' },
  ])('fails closed for invalid session configuration', (configuration) => {
    expect(() => sessionSettings(new ConfigService(configuration))).toThrow();
  });
});
