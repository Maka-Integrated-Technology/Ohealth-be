import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { s3ClientProvider } from './providers/s3-client.provider';
import { StorageCleanupService } from './storage-cleanup.service';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [s3ClientProvider, StorageService, StorageCleanupService],
  exports: [StorageService, StorageCleanupService],
})
export class StorageModule {}
