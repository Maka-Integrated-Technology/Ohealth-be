import { ConfigService } from '@nestjs/config';

import config from '../../src/config/config';
import { initializeDataSource } from '../../src/database/data-source';
import { AuthChallengeDeliveryService } from '../../src/modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengeService } from '../../src/modules/auth/challenges/auth-challenge.service';
import { EmailService } from '../../src/modules/email/email.service';

/**
 * One bounded operator-run batch. No HTTP entry point, scheduler, automatic
 * retries or identifying/secret telemetry. Run only on trusted workers.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !/^--batch-size=[0-9]+$/.test(args[0]))
  ) {
    throw new Error('Invalid challenge delivery dispatch arguments.');
  }
  const batchSize = args.length
    ? Number(args[0].slice('--batch-size='.length))
    : 5;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10) {
    throw new Error('Invalid challenge delivery dispatch batch size.');
  }
  const settings = new ConfigService(config());
  const dataSource = await initializeDataSource();
  try {
    const email = new EmailService(settings);
    const challenges = new AuthChallengeService(dataSource, settings);
    const service = new AuthChallengeDeliveryService(
      dataSource,
      settings,
      challenges,
      email,
    );
    const result = await service.dispatchBatch(batchSize);
    process.stdout.write(
      'Challenge delivery accepted=' + result.accepted +
        ' retried=' + result.retried +
        ' discarded=' + result.discarded + '\n',
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch(() => {
  // Do not print raw provider, database or secret-related exceptions.
  process.stderr.write('Challenge delivery dispatch failed.\n');
  process.exitCode = 1;
});
