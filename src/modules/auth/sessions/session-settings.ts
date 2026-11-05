import { ConfigService } from '@nestjs/config';

export interface ISessionSettings {
  jwtSecret: string;
  accessDurationSeconds: number;
  refreshDurationSeconds: number;
}

function requiredSecret(config: ConfigService): string {
  const value = config.get<string>('JWT_SECRET')?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      'JWT_SECRET must contain at least 32 non-whitespace characters.',
    );
  }
  return value;
}

function requiredDuration(
  config: ConfigService,
  key: 'TOKEN_ACCESS_DURATION' | 'TOKEN_REFRESH_DURATION',
  maximum: number,
): number {
  const value = config.get<string>(key)?.trim();
  if (!value) throw new Error(`${key} is required.`);

  const match = value.match(/^(\d+)([smhd])?$/);
  if (!match) {
    throw new Error(
      `${key} must be seconds or a lowercase s, m, h, or d duration.`,
    );
  }
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(match[1]) * (match[2] ? units[match[2]] : 1);
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > maximum) {
    throw new Error(`${key} must be between 1 and ${maximum} seconds.`);
  }
  return seconds;
}

export function sessionSettings(config: ConfigService): ISessionSettings {
  return {
    jwtSecret: requiredSecret(config),
    accessDurationSeconds: requiredDuration(
      config,
      'TOKEN_ACCESS_DURATION',
      900,
    ),
    refreshDurationSeconds: requiredDuration(
      config,
      'TOKEN_REFRESH_DURATION',
      30 * 24 * 60 * 60,
    ),
  };
}
