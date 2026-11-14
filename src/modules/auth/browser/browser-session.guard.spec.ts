/* eslint-disable @typescript-eslint/naming-convention */
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Request } from 'express';

import { BrowserSessionConfig } from './browser-session.config';
import { BrowserSessionGuard } from './browser-session.guard';

describe('BrowserSessionGuard', () => {
  const config = {
    isEnabled: jest.fn(() => true),
    allowedOrigins: jest.fn(() => ['https://app.ohealth.example']),
  } as unknown as BrowserSessionConfig;
  const guard = new BrowserSessionGuard(config);

  beforeEach(() => jest.clearAllMocks());

  it('accepts the exact origin, browser header, and JSON body', () => {
    expect(guard.canActivate(context(request()))).toBe(true);
  });

  it.each([
    undefined,
    'null',
    '*',
    'https://app.ohealth.example.evil.test',
    'https://evil-app.ohealth.example',
    'https://APP.ohealth.example',
    'https://app.ohealth.example.',
  ])('rejects origin %s', (origin) => {
    expect(() => guard.canActivate(context(request({ origin })))).toThrow(
      ForbiddenException,
    );
  });

  it.each([undefined, '', 'mobile', 'Browser'])(
    'rejects browser header %s',
    (client) => {
      expect(() => guard.canActivate(context(request({ client })))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('rejects a non-JSON body', () => {
    expect(() =>
      guard.canActivate(context(request({ contentType: 'text/plain' }))),
    ).toThrow(UnsupportedMediaTypeException);
  });

  it.each([
    { authorization: 'Bearer ' + 'a'.repeat(43) },
    { query: { refresh_token: 'a'.repeat(43) } },
    { body: { refresh_token: 'a'.repeat(43) } },
  ])('rejects alternate refresh credential transport %#', (overrides) => {
    expect(() =>
      guard.canActivate(context(request({ path: '/refresh', ...overrides }))),
    ).toThrow(BadRequestException);
  });

  function request(
    overrides: {
      origin?: string;
      client?: string;
      contentType?: string;
      path?: string;
      authorization?: string;
      query?: Record<string, string>;
      body?: Record<string, string>;
    } = {},
  ): Request {
    const headers: Record<string, string> = {
      origin:
        overrides.origin === undefined && !('origin' in overrides)
          ? 'https://app.ohealth.example'
          : overrides.origin,
      'x-ohealth-client':
        overrides.client === undefined && !('client' in overrides)
          ? 'browser'
          : overrides.client,
      'content-type': overrides.contentType ?? 'application/json',
      'content-length': '2',
    };
    if (overrides.authorization) {
      headers.authorization = overrides.authorization;
    }
    return {
      baseUrl: '/api/auth/browser',
      route: { path: overrides.path ?? '/verify' },
      path: overrides.path ?? '/verify',
      query: overrides.query ?? {},
      body: overrides.body ?? {},
      get: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;
  }

  function context(req: Request): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }
});
