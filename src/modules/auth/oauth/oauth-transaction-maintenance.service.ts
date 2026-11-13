import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class OAuthTransactionMaintenanceService {
  constructor(private readonly dataSource: DataSource) {}

  async pruneExpired(batchSize = 200): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      throw new Error('OAuth prune batch size must be between 1 and 500.');
    }
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `WITH expired AS (
         SELECT id FROM oauth_transactions
         WHERE expires_at < now() - interval '24 hours'
         ORDER BY expires_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       DELETE FROM oauth_transactions transaction
       USING expired
       WHERE transaction.id = expired.id
       RETURNING transaction.id`,
      [batchSize],
    );
    return rows.length;
  }
}
