import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { ConfigService } from '@nestjs/config';

import config from '../../src/config/config';
import { initializeDataSource } from '../../src/database/data-source';
import { AuthChallengeDeliveryService } from '../../src/modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengeService } from '../../src/modules/auth/challenges/auth-challenge.service';
import { EmailService } from '../../src/modules/email/email.service';

class ChallengeDispatchUsageError extends Error {}

interface IOptions {
  batchSize: number;
  continuous: boolean;
  intervalSeconds: number;
}

function parseArgs(args: string[]): IOptions {
  const params = new Map<string, string>();
  for (const arg of args) {
    if (arg === '--continuous') {
      if (params.has(arg)) throw new ChallengeDispatchUsageError();
      params.set(arg, 'true');
    } else {
      const match = /^(--batch-size|--interval-seconds)=([0-9]+)$/.exec(arg);
      if (!match || params.has(match[1]))
        throw new ChallengeDispatchUsageError();
      params.set(match[1], match[2]);
    }
  }
  const batchSize = Number(params.get('--batch-size') ?? 5);
  const intervalSeconds = Number(params.get('--interval-seconds') ?? 5);
  const continuous = params.has('--continuous');
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 10 ||
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 1 ||
    intervalSeconds > 15 ||
    (params.has('--interval-seconds') && !continuous)
  ) {
    throw new ChallengeDispatchUsageError();
  }
  return { batchSize, intervalSeconds, continuous };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const settings = new ConfigService(config());
  const dataSource = await initializeDataSource();
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  try {
    const email = new EmailService(settings);
    const challenges = new AuthChallengeService(dataSource, settings);
    challenges.assertConfigured();
    const service = new AuthChallengeDeliveryService(
      dataSource,
      settings,
      challenges,
      email,
    );
    service.assertConfigured();
    do {
      const result = await service.dispatchBatch(options.batchSize);
      // Aggregate-only operational signals; no addresses, codes, or token IDs.
      const metrics: Array<{
        pending: string;
        expired_leases: string;
        oldest_pending_seconds: string | null;
      }> = await dataSource.query(
        'SELECT ' +
          "COUNT(*) FILTER (WHERE status = 'pending')::text AS pending, " +
          "COUNT(*) FILTER (WHERE status = 'processing' AND lease_expires_at < now())::text AS expired_leases, " +
          "EXTRACT(EPOCH FROM now() - MIN(created_at) FILTER (WHERE status = 'pending'))::text AS oldest_pending_seconds " +
          'FROM auth_challenge_deliveries',
      );
      const pending = Number(metrics[0]?.pending ?? 0);
      const expiredLeases = Number(metrics[0]?.expired_leases ?? 0);
      const oldestSeconds = Math.ceil(
        Number(metrics[0]?.oldest_pending_seconds ?? 0),
      );
      process.stdout.write(
        'Challenge delivery accepted=' +
          result.accepted +
          ' retried=' +
          result.retried +
          ' discarded=' +
          result.discarded +
          ' pending=' +
          pending +
          ' expired_leases=' +
          expiredLeases +
          ' oldest_pending_seconds=' +
          oldestSeconds +
          '\n',
      );
      if (oldestSeconds >= 120 || expiredLeases > 0) {
        process.stderr.write('Challenge delivery backlog needs attention.\n');
      }
      // A committed, aggregate-only heartbeat lets live API producers fail
      // closed when the dispatcher stops or the queue becomes dangerously old.
      if (options.continuous) {
        await dataSource.query(
          'INSERT INTO auth_challenge_worker_heartbeat ' +
            '(id, last_seen_at, pending, oldest_pending_seconds, expired_leases) ' +
            "VALUES ('delivery', now(), $1, $2, $3) " +
            'ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), ' +
            'pending = EXCLUDED.pending, ' +
            'oldest_pending_seconds = EXCLUDED.oldest_pending_seconds, ' +
            'expired_leases = EXCLUDED.expired_leases',
          [pending, oldestSeconds, expiredLeases],
        );
      }
      // The health file updates only after a successful DB cycle.
      // Infrastructure checks must alert on a stale heartbeat and queue age.
      if (options.continuous) {
        if (oldestSeconds < 120 && expiredLeases === 0) {
          await writeFile(
            process.env.AUTH_CHALLENGE_WORKER_HEALTH_FILE ??
              '/tmp/ohealth-challenge-worker-heartbeat',
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

void main().catch((error: unknown) => {
  // No raw provider, recipient, database or secret exceptions in logs.
  if (error instanceof ChallengeDispatchUsageError) {
    process.stderr.write('Invalid challenge delivery dispatch arguments.\n');
  } else {
    process.stderr.write('Challenge delivery dispatch failed.\n');
  }
  process.exitCode = 1;
});
