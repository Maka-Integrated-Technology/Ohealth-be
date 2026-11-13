import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LaboratoryAdmin } from '../../laboratory/entities/laboratory-admin.entity';
import { LaboratoryStaff } from '../../laboratory/entities/laboratory-staff.entity';
import { OrganizationAdmin } from '../../organization/entities/organization-admin.entity';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { Professional } from '../../professional/entities/professional.entity';
import { User } from '../../user/entities/user.entity';
import { UserModule } from '../../user/user.module';
import { AuthRoutingService } from '../auth-routing.service';
import { AuthAbuseGuard } from '../challenges/auth-abuse.guard';
import { AuthChallengeModule } from '../challenges/auth-challenge.module';
import { AuthSession } from '../entities/auth.entity';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { RegistrationModule } from '../registration/registration.module';
import { AuthSecurityAuditModule } from '../security-audit/auth-security-audit.module';
import { RefreshSessionModule } from '../sessions/refresh-session.module';

import { ExternalIdentity } from './external-identity.entity';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { OAuthTransactionMaintenanceService } from './oauth-transaction-maintenance.service';
import { OAuthTransaction } from './oauth-transaction.entity';
import { OAuthTransactionService } from './oauth-transaction.service';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    AuthChallengeModule,
    AuthSecurityAuditModule,
    RefreshSessionModule,
    RegistrationModule,
    TypeOrmModule.forFeature([
      OAuthTransaction,
      ExternalIdentity,
      AuthSession,
      User,
      PatientProfile,
      Professional,
      OrganizationAdmin,
      LaboratoryAdmin,
      LaboratoryStaff,
    ]),
  ],
  controllers: [OAuthController],
  providers: [
    OAuthService,
    OAuthTransactionService,
    OAuthTransactionMaintenanceService,
    GoogleTokenVerifierService,
    PasswordCredentialsService,
    AuthRoutingService,
    AuthAbuseGuard,
  ],
})
export class OAuthModule {}
