import { ConfigService } from '@nestjs/config';

/** Explicit startup schema shared by issuance and JWT verification. No fallbacks. */
export function sessionSettings(config: ConfigService) {
  const secret = config.get<string>('JWT_SECRET');
  if (typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  const duration = (key: string, maximum: number) => {
    const value = config.get<string>(key);
    const match =
      typeof value === 'string' ? /^(\d+)([smhd]?)$/.exec(value) : null;
    const seconds = match
      ? Number(match[1]) *
        ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2] || 's'] ?? 0)
      : 0;
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > maximum) {
      throw new Error(`${key} must be between 1 and ${maximum} seconds`);
    }
    return seconds;
  };
  return {
    secret,
    accessSeconds: duration('TOKEN_ACCESS_DURATION', 900),
    refreshSeconds: duration('TOKEN_REFRESH_DURATION', 2592000),
  };
}
