import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../email/email.module';
import { UserPersona } from '../identity/entities/user-persona.entity';
import { LaboratoryAdmin } from '../laboratory/entities/laboratory-admin.entity';
import { LaboratoryStaff } from '../laboratory/entities/laboratory-staff.entity';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { OrganizationMembership } from '../organization/entities/organization-membership.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Professional } from '../professional/entities/professional.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BrowserSessionCookieService } from './browser/browser-session-cookie.service';
import { BrowserSessionTransportService } from './browser/browser-session-transport.service';
import { BrowserSessionConfig } from './browser/browser-session.config';
import { BrowserSessionController } from './browser/browser-session.controller';
import { BrowserSessionGuard } from './browser/browser-session.guard';
import { AuthAbuseGuard } from './challenges/auth-abuse.guard';
import { AuthChallengeModule } from './challenges/auth-challenge.module';
import { SecureAuthChallengeFlowsService } from './challenges/secure-auth-challenge-flows.service';
import { AuthContextService } from './context/auth-context.service';
import { PlatformPrivilegeEntity } from './context/platform-privilege.entity';
import { AuthSession } from './entities/auth.entity';
import { User2fa } from './entities/user-2fa.entity';
import { CapabilitiesGuard } from './guards/capabilities.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OAuthModule } from './oauth/oauth.module';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { RegistrationModule } from './registration/registration.module';
import { AuthSecurityAuditModule } from './security-audit/auth-security-audit.module';
import { RefreshSessionModule } from './sessions/refresh-session.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
  imports: [
    AuthChallengeModule,
    AuthSecurityAuditModule,
    RefreshSessionModule,
    RegistrationModule,
    OAuthModule,
    ConfigModule,
    EmailModule,
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      User2fa,
      Professional,
      OrganizationAdmin,
      LaboratoryAdmin,
      LaboratoryStaff,
      User,
      UserPersona,
      Organization,
      OrganizationMembership,
      AuthSession,
      PlatformPrivilegeEntity,
    ]),
  ],
  controllers: [
    AuthController,
    BrowserSessionController,
    TwoFactorAuthController,
  ],
  providers: [
    AuthService,
    BrowserSessionConfig,
    BrowserSessionCookieService,
    BrowserSessionGuard,
    BrowserSessionTransportService,
    SecureAuthChallengeFlowsService,
    AuthContextService,
    AuthAbuseGuard,
    PasswordCredentialsService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    CapabilitiesGuard,
    TwoFactorAuthService,
  ],
  exports: [
    AuthChallengeModule,
    RefreshSessionModule,
    RegistrationModule,
    OAuthModule,
    AuthService,
    PasswordCredentialsService,
    JwtAuthGuard,
    RolesGuard,
    AuthContextService,
    CapabilitiesGuard,
  ],
})
export class AuthModule {}
