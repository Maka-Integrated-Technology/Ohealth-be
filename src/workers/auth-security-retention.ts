import { env } from 'node:process';

import { S3Client } from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';

import { AuthSecurityRetentionService } from '../modules/auth/security-audit/auth-security-retention.service';
import {
  objectStorageClientConfig,
  parseObjectStorageSettings,
} from '../modules/storage/object-storage-config';

function required(name: string): string {
  const value = env[name]?.trim();
  if (!value)
    throw new Error(`Missing required audit retention setting: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const operation = process.argv[2];
  const batch = /^--archive-batch=([1-9][0-9]{0,2})$/.exec(operation ?? '');
  if (
    process.argv.length !== 3 ||
    (!batch &&
      operation !== '--purge-online' &&
      operation !== '--purge-archive')
  ) {
    throw new Error('Invalid auth audit retention command.');
  }
  const batchSize = batch ? Number(batch[1]) : 0;
  if (batchSize > 500) {
    throw new Error('Invalid auth audit retention batch size.');
  }
  const database = new DataSource({
    type: 'postgres',
    url: required('AUTH_AUDIT_RETENTION_DATABASE_URL'),
  });
  const archive = parseObjectStorageSettings(
    env,
    'AUTH_AUDIT_ARCHIVE',
    env.NODE_ENV === 'test',
  );
  const s3 = new S3Client(objectStorageClientConfig(archive));
  const service = new AuthSecurityRetentionService(database, s3, {
    bucket: archive.bucket,
  });
  const initiator =
    operation === '--purge-online' || operation === '--purge-archive'
      ? required('AUTH_AUDIT_RETENTION_INITIATOR')
      : '';
  const approval =
    operation === '--purge-online' || operation === '--purge-archive'
      ? required('AUTH_AUDIT_RETENTION_APPROVAL_REFERENCE')
      : '';
  await database.initialize();
  try {
    if (batch) {
      let archived = 0;
      for (let index = 0; index < batchSize; index += 1) {
        if (!(await service.archiveNext())) break;
        archived += 1;
      }
      process.stdout.write(`Archived ${archived} auth security events.\n`);
    } else if (operation === '--purge-online') {
      const purged = await service.purgeOnline(initiator, approval);
      process.stdout.write(`Purged ${purged} verified online events.\n`);
    } else {
      let purged = 0;
      while (
        purged < 100 &&
        (await service.purgeExpiredArchive(initiator, approval))
      ) {
        purged += 1;
      }
      process.stdout.write(`Purged ${purged} expired archive events.\n`);
    }
  } finally {
    await database.destroy();
    s3.destroy();
  }
}

void main().catch(() => {
  process.stderr.write('Auth audit retention maintenance failed.\n');
  process.exitCode = 1;
});
