import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../auth.module';

import { RegistrationRecordsService } from './registration-records.service';

/**
 * Internal staging module only. Do not expose the old or a second public
 * signup path until durable challenge delivery and session integration land.
 */
@Module({
  imports: [AuthModule, ConfigModule],
  providers: [RegistrationRecordsService],
  exports: [RegistrationRecordsService],
})
export class RegistrationModule {}
