import { Module } from '@nestjs/common';

import { AuthChallengeModule } from '../challenges/auth-challenge.module';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AuthSecurityAuditModule } from '../security-audit/auth-security-audit.module';

import { RegistrationRetryMaintenanceService } from './registration-retry-maintenance.service';
import { RegistrationService } from './registration.service';

@Module({
  imports: [AuthChallengeModule, AuthSecurityAuditModule],
  providers: [
    PasswordCredentialsService,
    RegistrationService,
    RegistrationRetryMaintenanceService,
  ],
  exports: [RegistrationService, RegistrationRetryMaintenanceService],
})
export class RegistrationModule {}
