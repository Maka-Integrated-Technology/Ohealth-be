import { ConfigService } from '@nestjs/config';

import config from '../config/config';
import { initializeDataSource } from '../database/data-source';
import { s3ClientProvider } from '../modules/storage/providers/s3-client.provider';
import { StorageCleanupService } from '../modules/storage/storage-cleanup.service';
import { StorageService } from '../modules/storage/storage.service';

export async function run(args = process.argv.slice(2)): Promise<void> {
  if (
    args.length > 1 ||
    (args.length === 1 && !/^[1-9][0-9]{0,1}$|^100$/.test(args[0]))
  ) {
    throw new Error('Invalid private-object cleanup batch size.');
  }
  const limit = args.length ? Number(args[0]) : 20;
  const dataSource = await initializeDataSource();
  let client: ReturnType<typeof s3ClientProvider.useFactory> | undefined;
  try {
    const settings = new ConfigService(config());
    client = s3ClientProvider.useFactory(settings);
    const cleanup = new StorageCleanupService(
      dataSource,
      new StorageService(client, settings),
    );
    const result = await cleanup.processPending(limit);
    process.stdout.write(
      `Private object cleanup completed=${result.completed} failed=${result.failed}\n`,
    );
    if (result.failed) process.exitCode = 1;
  } finally {
    client?.destroy();
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  void run().catch(() => {
    process.stderr.write('Private object cleanup failed.\n');
    process.exitCode = 1;
  });
}
