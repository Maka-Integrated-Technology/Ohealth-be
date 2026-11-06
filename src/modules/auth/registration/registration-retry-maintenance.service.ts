import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Deletes only retry receipts; identity, consent and challenge evidence remain. */
@Injectable()
export class RegistrationRetryMaintenanceService {
  constructor(private readonly dataSource: DataSource) {}

  async pruneExpired(batchSize = 200): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      throw new BadRequestException('Invalid registration cleanup batch size.');
    }
    return this.dataSource.transaction(async (manager) => {
      const rows: Array<{ removed_count: number }> = await manager.query(
        `WITH stale AS (
           SELECT request_key_hash FROM registration_attempts
           WHERE created_at < now() - interval '24 hours'
           ORDER BY created_at, request_key_hash
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         ), removed AS (
           DELETE FROM registration_attempts retry USING stale
           WHERE retry.request_key_hash = stale.request_key_hash
           RETURNING 1
         )
         SELECT count(*)::int AS removed_count FROM removed`,
        [batchSize],
      );
      return Number(rows[0]?.removed_count ?? 0);
    });
  }
}
