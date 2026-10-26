import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  hits: number;
}

/** Atomic PostgreSQL counters; stored keys use secret-keyed HMAC, not raw IPs. */
@Injectable()
export class AuthRateLimitService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  consume(
    scope: string,
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    return this.dataSource.transaction((manager) =>
      this.consumeInTransaction(manager, scope, key, limit, windowSeconds),
    );
  }

  async consumeInTransaction(
    manager: EntityManager,
    scope: string,
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('Rate limit updates require an active transaction.');
    }
    if (
      !scope ||
      !key ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      !Number.isInteger(windowSeconds) ||
      windowSeconds < 1 ||
      windowSeconds > 86_400
    ) {
      throw new Error('Invalid rate limit configuration.');
    }
    const pepper = this.config.get<string>('AUTH_CHALLENGE_PEPPER');
    if (!pepper || Buffer.byteLength(pepper, 'utf8') < 32) {
      throw new Error('AUTH_CHALLENGE_PEPPER is required for rate limiting.');
    }
    const digest = createHmac('sha256', pepper)
      .update('ohealth:rate-limit:v1:', 'utf8')
      .update(scope, 'utf8')
      .update(':', 'utf8')
      .update(key, 'utf8')
      .digest('hex');
    const rows: Array<{ hits: number; window_ends_at: Date }> =
      await manager.query(
        `
        INSERT INTO auth_rate_limit_buckets (key_hash, hits, window_ends_at)
        VALUES ($1, 1, now() + ($2::integer * interval '1 second'))
        ON CONFLICT (key_hash) DO UPDATE SET
          hits = CASE
            WHEN auth_rate_limit_buckets.window_ends_at <= now() THEN 1
            ELSE auth_rate_limit_buckets.hits + 1
          END,
          window_ends_at = CASE
            WHEN auth_rate_limit_buckets.window_ends_at <= now()
              THEN EXCLUDED.window_ends_at
            ELSE auth_rate_limit_buckets.window_ends_at
          END
        RETURNING hits, window_ends_at
        `,
        [digest, windowSeconds],
      );
    const { hits, window_ends_at: windowEnd } = rows[0];
    return {
      hits,
      allowed: hits <= limit,
      retryAfterSeconds:
        hits > limit
          ? Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000))
          : 0,
    };
  }
}
