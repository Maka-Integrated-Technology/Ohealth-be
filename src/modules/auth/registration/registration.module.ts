import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../auth.module';

import { RegistrationRecordsService } from './registration-records.service';
import { RegistrationRetryMaintenanceService } from './registration-retry-maintenance.service';

/**
 * Internal staging module only. Do not expose the old or a second public
 * signup path until durable challenge delivery and session integration land.
 */
@Module({
  imports: [AuthModule, ConfigModule],
  providers: [RegistrationRecordsService, RegistrationRetryMaintenanceService],
  exports: [RegistrationRecordsService, RegistrationRetryMaintenanceService],
})
export class RegistrationModule {}
