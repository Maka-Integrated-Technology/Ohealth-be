import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Internal maintenance boundary only. An approved worker/operations command
 * must invoke this on its own bounded cadence; there is no public route,
 * scheduler, or automatic execution in this foundation.
 *
 * Rows are retained for 24 hours after the original challenge expires.
 * Deleting a receipt never removes the user, challenge, acceptance or outbox.
 */
@Injectable()
export class RegistrationRetryMaintenanceService {
  private static readonly maxBatchSize = 500;

  constructor(private readonly dataSource: DataSource) {}

  async pruneExpired(batchSize = 200): Promise<number> {
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > RegistrationRetryMaintenanceService.maxBatchSize
    ) {
      throw new BadRequestException('Invalid registration cleanup batch size.');
    }
    return this.dataSource.transaction(async (manager) => {
      // SKIP LOCKED avoids blocking active retry transactions. A bounded batch
      // keeps row locks, WAL and worker pressure predictable across instances.
      const rows: Array<{ removed_count: number }> = await manager.query(
        `WITH stale AS (
           SELECT request_key_hash FROM registration_attempts
           WHERE challenge_expires_at < now() - interval '24 hours'
           ORDER BY challenge_expires_at, request_key_hash
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         ), removed AS (
           DELETE FROM registration_attempts AS retry
           USING stale
           WHERE retry.request_key_hash = stale.request_key_hash
           RETURNING 1
         )
         SELECT count(*)::int AS removed_count FROM removed`,
        [batchSize],
      );
      // A SELECT count has a stable one-row shape across query adapters.
      // Never log HMAC keys, linked accounts or response data.
      return rows[0].removed_count;
    });
  }
}
