import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';

import * as sysMsg from '../../../constants/system.messages';

import { BrowserSessionConfig } from './browser-session.config';
import { BROWSER_REFRESH_COOKIE_ALIASES } from './browser-session.constants';

const OPAQUE_REFRESH = /^[A-Za-z0-9_-]{43}$/;
const MAX_COOKIE_HEADER_BYTES = 8192;

@Injectable()
export class BrowserSessionCookieService {
  constructor(private readonly config: BrowserSessionConfig) {}

  write(
    response: Response,
    credential: string,
    sessionExpiresAt: Date,
    now = new Date(),
  ): void {
    const remaining = Math.max(0, sessionExpiresAt.getTime() - now.getTime());
    const { name, ...options } = this.config.cookiePolicy();
    response.cookie(name, credential, { ...options, maxAge: remaining });
  }

  clear(response: Response): void {
    const { name, ...options } = this.config.cookiePolicy();
    response.clearCookie(name, options);
  }

  extract(request: Request): string {
    const header = request.headers.cookie;
    if (
      !header ||
      Buffer.byteLength(header, 'utf8') > MAX_COOKIE_HEADER_BYTES
    ) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }
    const approvedName = this.config.cookiePolicy().name;
    let credential: string | undefined;
    for (const part of header.split(';')) {
      const separator = part.indexOf('=');
      const name = (separator >= 0 ? part.slice(0, separator) : part).trim();
      const value = separator >= 0 ? part.slice(separator + 1).trim() : '';
      if (!BROWSER_REFRESH_COOKIE_ALIASES.has(name)) continue;
      if (name !== approvedName || credential !== undefined) {
        throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
      }
      credential = value;
    }
    if (!credential || !OPAQUE_REFRESH.test(credential)) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }
    return credential;
  }

  options(): CookieOptions & { name: string } {
    return this.config.cookiePolicy();
  }
}
