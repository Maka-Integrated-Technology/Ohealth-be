import { initializeDataSource } from '../../src/database/data-source';
import { RegistrationRetryMaintenanceService } from '../../src/modules/auth/registration/registration-retry-maintenance.service';

/**
 * Trusted operator command. One bounded batch only, no HTTP endpoint,
 * background timer, credential logging, or implicit schema migration.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !/^--batch-size=[0-9]+$/.test(args[0]))
  ) {
    throw new Error('Expected optional --batch-size=1..500 only.');
  }
  const batchSize = args.length
    ? Number(args[0].slice('--batch-size='.length))
    : 200;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error('Invalid registration retry cleanup batch size.');
  }
  const dataSource = await initializeDataSource();
  try {
    const service = new RegistrationRetryMaintenanceService(dataSource);
    const removed = await service.pruneExpired(batchSize);
    // Count-only operational telemetry. No identifiers or row values.
    process.stdout.write(`Expired registration retry receipts pruned: ${removed}\n`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch(() => {
  // Database exceptions may include sensitive SQL values: do not echo them.
  process.stderr.write('Registration retry maintenance failed.\n');
  process.exitCode = 1;
});
