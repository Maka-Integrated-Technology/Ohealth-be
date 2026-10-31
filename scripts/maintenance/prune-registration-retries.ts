import { initializeDataSource } from '../../src/database/data-source';
import { RegistrationRetryMaintenanceService } from '../../src/modules/auth/registration/registration-retry-maintenance.service';

/**
 * Trusted operator command. One bounded batch only, no HTTP endpoint,
 * background timer, credential logging, or implicit schema migration.
 */
class RegistrationRetryUsageError extends Error {}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !/^--batch-size=[0-9]+$/.test(args[0]))
  ) {
    throw new RegistrationRetryUsageError();
  }
  const batchSize = args.length
    ? Number(args[0].slice('--batch-size='.length))
    : 200;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new RegistrationRetryUsageError();
  }
  const dataSource = await initializeDataSource();
  try {
    const service = new RegistrationRetryMaintenanceService(dataSource);
    const removed = await service.pruneExpired(batchSize);
    // Count-only operational telemetry. No identifiers or row values.
    process.stdout.write(
      `Expired registration retry receipts pruned: ${removed}\n`,
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  // Distinguish locally validated CLI usage from a real database failure.
  // Never echo SQL or connection exceptions, which may contain secrets.
  if (error instanceof RegistrationRetryUsageError) {
    process.stderr.write('Invalid registration retry maintenance arguments.\n');
  } else {
    process.stderr.write('Registration retry maintenance failed.\n');
  }
  process.exitCode = 1;
});
