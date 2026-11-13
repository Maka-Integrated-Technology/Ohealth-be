import { writeFile } from 'node:fs/promises';
import { env } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

import { ConfigService } from '@nestjs/config';

import config from '../config/config';
import { initializeDataSource } from '../database/data-source';
import { OAuthSecurityNotificationService } from '../modules/auth/oauth/oauth-security-notification.service';
import { EmailService } from '../modules/email/email.service';

class OAuthNotificationDispatchUsageError extends Error {}

interface IOptions {
  batchSize: number;
  continuous: boolean;
  intervalSeconds: number;
}

function parseArgs(args: string[]): IOptions {
  const params = new Map<string, string>();
  for (const arg of args) {
    if (arg === '--continuous') {
      if (params.has(arg)) throw new OAuthNotificationDispatchUsageError();
      params.set(arg, 'true');
    } else {
      const match = /^(--batch-size|--interval-seconds)=([0-9]+)$/.exec(arg);
      if (!match || params.has(match[1]))
        throw new OAuthNotificationDispatchUsageError();
      params.set(match[1], match[2]);
    }
  }
  const batchSize = Number(params.get('--batch-size') ?? 20);
  const intervalSeconds = Number(params.get('--interval-seconds') ?? 5);
  const continuous = params.has('--continuous');
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 100 ||
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 1 ||
    intervalSeconds > 60 ||
    (params.has('--interval-seconds') && !continuous)
  ) {
    throw new OAuthNotificationDispatchUsageError();
  }
  return { batchSize, continuous, intervalSeconds };
}

export async function run(args = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  const dataSource = await initializeDataSource();
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  try {
    const settings = new ConfigService(config());
    const service = new OAuthSecurityNotificationService(
      dataSource,
      new EmailService(settings),
    );
    do {
      const processed = await service.dispatchBatch(options.batchSize);
      const metrics: Array<{
        pending: string;
        oldest_pending_seconds: string | null;
      }> = await dataSource.query(
        'SELECT ' +
          'COUNT(*)::text AS pending, ' +
          'EXTRACT(EPOCH FROM now() - MIN(created_at))::text AS oldest_pending_seconds ' +
          'FROM outbox_events WHERE event_type = $1 AND status = $2',
        ['oauth_google_unlinked', 'pending'],
      );
      const pending = Number(metrics[0]?.pending ?? 0);
      const oldestSeconds = Math.ceil(
        Number(metrics[0]?.oldest_pending_seconds ?? 0),
      );
      process.stdout.write(
        `OAuth security notifications processed=${processed} pending=${pending} oldest_pending_seconds=${oldestSeconds}\n`,
      );
      if (oldestSeconds >= 120) {
        process.stderr.write(
          'OAuth security notification backlog needs attention.\n',
        );
      }
      if (options.continuous) {
        if (oldestSeconds < 120) {
          await writeFile(
            env.OAUTH_NOTIFICATION_WORKER_HEALTH_FILE ??
              '/tmp/ohealth-oauth-notification-worker-heartbeat',
            new Date().toISOString(),
            'utf8',
          );
        }
        if (!stopping) await sleep(options.intervalSeconds * 1000);
      }
    } while (options.continuous && !stopping);
  } finally {
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  void run().catch((error: unknown) => {
    if (error instanceof OAuthNotificationDispatchUsageError) {
      process.stderr.write(
        'Invalid OAuth security notification dispatch arguments.\n',
      );
    } else {
      process.stderr.write('OAuth security notification dispatch failed.\n');
    }
    process.exitCode = 1;
  });
}
