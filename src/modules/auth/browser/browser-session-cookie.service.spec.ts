import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';

import { BrowserSessionCookieService } from './browser-session-cookie.service';
import { BrowserSessionConfig } from './browser-session.config';
import {
  BROWSER_REFRESH_COOKIE,
  DEVELOPMENT_BROWSER_REFRESH_COOKIE,
} from './browser-session.constants';

describe('BrowserSessionCookieService', () => {
  const credential = 'a'.repeat(43);
  const policy = {
    name: BROWSER_REFRESH_COOKIE,
    secure: true,
    httpOnly: true as const,
    sameSite: 'strict' as const,
    path: '/' as const,
  };
  const config = {
    cookiePolicy: jest.fn(() => policy),
  } as unknown as BrowserSessionConfig;
  const service = new BrowserSessionCookieService(config);

  beforeEach(() => jest.clearAllMocks());

  it('bounds Max-Age by the remaining absolute session lifetime', () => {
    const response = { cookie: jest.fn() } as unknown as Response;
    service.write(
      response,
      credential,
      new Date('2026-01-01T00:00:05.250Z'),
      new Date('2026-01-01T00:00:00.500Z'),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      BROWSER_REFRESH_COOKIE,
      credential,
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 4750,
      }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      BROWSER_REFRESH_COOKIE,
      credential,
      expect.not.objectContaining({ domain: expect.anything() }),
    );
  });

  it('clears with the same custody attributes used for issuance', () => {
    const response = { clearCookie: jest.fn() } as unknown as Response;
    service.clear(response);
    expect(response.clearCookie).toHaveBeenCalledWith(BROWSER_REFRESH_COOKIE, {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });
  });

  it('extracts only the approved cookie', () => {
    const request = {
      headers: {
        cookie: `theme=dark; ${BROWSER_REFRESH_COOKIE}=${credential}`,
      },
    } as Request;
    expect(service.extract(request)).toBe(credential);
  });

  it.each([
    '',
    `${BROWSER_REFRESH_COOKIE}=`,
    `${BROWSER_REFRESH_COOKIE}=short`,
    `${BROWSER_REFRESH_COOKIE}=${credential}; ${BROWSER_REFRESH_COOKIE}=${credential}`,
    `${DEVELOPMENT_BROWSER_REFRESH_COOKIE}=${credential}`,
    `refresh_token=${credential}`,
    `${BROWSER_REFRESH_COOKIE}=${'x'.repeat(44)}`,
    `${BROWSER_REFRESH_COOKIE}=%61${'a'.repeat(41)}`,
  ])('rejects an invalid or alternate cookie header', (cookie) => {
    const request = { headers: { cookie } } as Request;
    expect(() => service.extract(request)).toThrow(UnauthorizedException);
  });

  it('rejects oversized cookie headers', () => {
    const request = {
      headers: { cookie: `noise=${'x'.repeat(9000)}` },
    } as Request;
    expect(() => service.extract(request)).toThrow(UnauthorizedException);
  });
});
