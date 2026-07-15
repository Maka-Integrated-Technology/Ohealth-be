import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { s3ClientProvider } from './providers/s3-client.provider';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [s3ClientProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
