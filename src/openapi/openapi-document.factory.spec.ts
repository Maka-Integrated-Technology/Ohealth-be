import { ConfigService } from '@nestjs/config';

import { RegistrationService } from '../modules/auth/registration/registration.service';

import { resolveAuthRequestExampleValues } from './openapi-document.factory';

import type { INestApplication } from '@nestjs/common';

describe('runtime Swagger auth examples', () => {
  it('uses current public bootstrap versions and configured Google audiences', () => {
    const values = new Map<string, unknown>([
      ['oauth.google.enabled', true],
      ['oauth.google.webClientIds', 'web-current, web-older'],
      ['oauth.google.mobileClientIds', 'mobile-current'],
    ]);
    const config = { get: (key: string) => values.get(key) };
    const registration = {
      getBootstrap: () => ({
        terms: { version: 'terms-current' },
        privacy: { version: 'privacy-current' },
      }),
    };
    const app = {
      get: (token: unknown) =>
        token === ConfigService
          ? config
          : token === RegistrationService
            ? registration
            : undefined,
    } as unknown as INestApplication;
    expect(resolveAuthRequestExampleValues(app)).toEqual({
      termsVersion: 'terms-current',
      privacyVersion: 'privacy-current',
      googleWebAudience: 'web-current',
      googleMobileAudience: 'mobile-current',
    });
  });
});
