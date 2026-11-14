import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  BROWSER_REFRESH_COOKIE,
  DEVELOPMENT_BROWSER_REFRESH_COOKIE,
} from './browser-session.constants';

export interface IBrowserCookiePolicy {
  name: string;
  secure: boolean;
  httpOnly: true;
  sameSite: 'strict';
  path: '/';
}

const DEPLOYED_ENVIRONMENTS = new Set(['production', 'staging']);
const LOCAL_ENVIRONMENTS = new Set([
  '',
  'development',
  'localhost',
  'local',
  'dev',
  'test',
]);

@Injectable()
export class BrowserSessionConfig {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('AUTH_BROWSER_SESSION_ENABLED') === 'true';
  }

  allowedOrigins(): string[] {
    const configured = this.config.get<string[]>('cors.origins', []);
    return configured.map((origin) => this.assertExactOrigin(origin));
  }

  assertStartupConfigured(): void {
    if (!this.isEnabled()) return;
    if (
      !DEPLOYED_ENVIRONMENTS.has(this.environment()) &&
      !LOCAL_ENVIRONMENTS.has(this.environment())
    ) {
      throw new Error(
        'NODE_ENV must identify an approved local, staging, or production environment when browser sessions are enabled.',
      );
    }
    const origins = this.allowedOrigins();
    if (this.isDeployedEnvironment() && origins.length === 0) {
      throw new Error(
        'CORS_ORIGINS must contain at least one exact HTTPS origin when browser sessions are enabled in staging or production.',
      );
    }
  }

  cookiePolicy(): IBrowserCookiePolicy {
    if (
      this.isEnabled() &&
      !DEPLOYED_ENVIRONMENTS.has(this.environment()) &&
      !LOCAL_ENVIRONMENTS.has(this.environment())
    ) {
      throw new Error('Browser session environment is not approved.');
    }
    if (this.isDeployedEnvironment()) {
      return {
        name: BROWSER_REFRESH_COOKIE,
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      };
    }
    return {
      name: DEVELOPMENT_BROWSER_REFRESH_COOKIE,
      secure: false,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    };
  }

  private isDeployedEnvironment(): boolean {
    return DEPLOYED_ENVIRONMENTS.has(this.environment());
  }

  private environment(): string {
    return this.config.get<string>('NODE_ENV')?.trim().toLowerCase() ?? '';
  }

  private assertExactOrigin(value: string): string {
    if (!value || value === 'null' || value.includes('*')) {
      throw new Error('CORS_ORIGINS entries must be exact origins.');
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('CORS_ORIGINS entries must be valid origins.');
    }
    if (
      parsed.origin !== value ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      parsed.hostname.endsWith('.') ||
      !['http:', 'https:'].includes(parsed.protocol)
    ) {
      throw new Error('CORS_ORIGINS entries must be exact origins.');
    }
    if (this.isDeployedEnvironment() && parsed.protocol !== 'https:') {
      throw new Error(
        'CORS_ORIGINS entries must use HTTPS in staging and production.',
      );
    }
    return value;
  }
}
