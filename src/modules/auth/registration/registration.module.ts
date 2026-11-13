import { Module } from '@nestjs/common';

import { AuthChallengeModule } from '../challenges/auth-challenge.module';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AuthSecurityAuditModule } from '../security-audit/auth-security-audit.module';

import { AccountProvisioningService } from './account-provisioning.service';
import { RegistrationRetryMaintenanceService } from './registration-retry-maintenance.service';
import { RegistrationService } from './registration.service';

@Module({
  imports: [AuthChallengeModule, AuthSecurityAuditModule],
  providers: [
    PasswordCredentialsService,
    AccountProvisioningService,
    RegistrationService,
    RegistrationRetryMaintenanceService,
  ],
  exports: [
    RegistrationService,
    RegistrationRetryMaintenanceService,
    AccountProvisioningService,
  ],
})
export class RegistrationModule {}
