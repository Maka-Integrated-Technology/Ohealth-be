import { initializeDataSource } from '../../src/database/data-source';
import { RegistrationRetryMaintenanceService } from '../../src/modules/auth/registration/registration-retry-maintenance.service';

class RegistrationRetryPruneUsageError extends Error {}

function parseBatchSize(args: string[]): number {
  if (args.length > 1) throw new RegistrationRetryPruneUsageError();
  if (!args.length) return 200;
  const match = /^--batch-size=([0-9]+)$/.exec(args[0]);
  const batchSize = Number(match?.[1]);
  if (
    !match ||
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 500
  )
    throw new RegistrationRetryPruneUsageError();
  return batchSize;
}

async function main(): Promise<void> {
  const batchSize = parseBatchSize(process.argv.slice(2));
  const dataSource = await initializeDataSource();
  try {
    const removed = await new RegistrationRetryMaintenanceService(
      dataSource,
    ).pruneExpired(batchSize);
    process.stdout.write(`Registration retry receipts removed=${removed}\n`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof RegistrationRetryPruneUsageError
      ? 'Invalid registration retry prune arguments.\n'
      : 'Registration retry prune failed.\n',
  );
  process.exitCode = 1;
});
