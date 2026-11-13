/* eslint-disable @typescript-eslint/naming-convention */
import { ConfigService } from '@nestjs/config';

import { BrowserSessionConfig } from './browser-session.config';
import {
  BROWSER_REFRESH_COOKIE,
  DEVELOPMENT_BROWSER_REFRESH_COOKIE,
} from './browser-session.constants';

describe('BrowserSessionConfig', () => {
  it.each(['production', 'staging'])(
    'uses the immutable host cookie policy in %s',
    (environment) => {
      const service = configured({
        NODE_ENV: environment,
        AUTH_BROWSER_SESSION_ENABLED: 'true',
        cors: { origins: ['https://app.ohealth.example'] },
      });

      expect(service.cookiePolicy()).toEqual({
        name: BROWSER_REFRESH_COOKIE,
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      });
      expect(service.cookiePolicy()).not.toHaveProperty('domain');
      expect(() => service.assertStartupConfigured()).not.toThrow();
    },
  );

  it('uses a separately named local development cookie', () => {
    const service = configured({ NODE_ENV: 'development' });
    expect(service.cookiePolicy()).toMatchObject({
      name: DEVELOPMENT_BROWSER_REFRESH_COOKIE,
      secure: false,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });
  });

  it.each(['production', 'staging'])(
    'fails startup when enabled without origins in %s',
    (environment) => {
      const service = configured({
        NODE_ENV: environment,
        AUTH_BROWSER_SESSION_ENABLED: 'true',
        cors: { origins: [] },
      });
      expect(() => service.assertStartupConfigured()).toThrow('CORS_ORIGINS');
    },
  );

  it.each([
    'null',
    '*',
    'https://*.ohealth.example',
    'https://ohealth.example/',
    'https://OHEALTH.example',
    'https://ohealth.example.',
    'https://ohealth.example/path',
    'https://ohealth.example?query=1',
  ])('rejects non-exact origin %s', (origin) => {
    const service = configured({
      NODE_ENV: 'production',
      AUTH_BROWSER_SESSION_ENABLED: 'true',
      cors: { origins: [origin] },
    });
    expect(() => service.assertStartupConfigured()).toThrow('exact origins');
  });

  it('rejects non-HTTPS deployed origins', () => {
    const service = configured({
      NODE_ENV: 'production',
      AUTH_BROWSER_SESSION_ENABLED: 'true',
      cors: { origins: ['http://app.ohealth.example'] },
    });
    expect(() => service.assertStartupConfigured()).toThrow('HTTPS');
  });

  it('fails closed for a misspelled deployment environment', () => {
    const service = configured({
      NODE_ENV: 'prod',
      AUTH_BROWSER_SESSION_ENABLED: 'true',
      cors: { origins: ['https://app.ohealth.example'] },
    });
    expect(() => service.assertStartupConfigured()).toThrow('NODE_ENV');
    expect(() => service.cookiePolicy()).toThrow('not approved');
  });

  function configured(values: Record<string, unknown>): BrowserSessionConfig {
    return new BrowserSessionConfig(new ConfigService(values));
  }
});
