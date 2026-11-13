import { initializeDataSource } from '../../src/database/data-source';
import { OAuthTransactionMaintenanceService } from '../../src/modules/auth/oauth/oauth-transaction-maintenance.service';

async function main(): Promise<void> {
  const match = /^--batch-size=([0-9]+)$/.exec(process.argv[2] ?? '');
  const batchSize = match ? Number(match[1]) : 200;
  if (
    process.argv.length > 3 ||
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 500
  ) {
    throw new Error('Invalid OAuth transaction prune arguments.');
  }
  const dataSource = await initializeDataSource();
  try {
    const removed = await new OAuthTransactionMaintenanceService(
      dataSource,
    ).pruneExpired(batchSize);
    process.stdout.write(`OAuth transactions removed=${removed}\n`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch(() => {
  process.stderr.write('OAuth transaction prune failed.\n');
  process.exitCode = 1;
});
