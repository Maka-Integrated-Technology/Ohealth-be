import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../email/email.module';
import { LaboratoryAdmin } from '../laboratory/entities/laboratory-admin.entity';
import { LaboratoryStaff } from '../laboratory/entities/laboratory-staff.entity';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { Professional } from '../professional/entities/professional.entity';
import { UserModule } from '../user/user.module';

import { AuthRoutingService } from './auth-routing.service';
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
import { User2fa } from './entities/user-2fa.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
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
    AuthRoutingService,
    AuthAbuseGuard,
    PasswordCredentialsService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TwoFactorAuthService,
  ],
  exports: [
    AuthChallengeModule,
    RefreshSessionModule,
    RegistrationModule,
    AuthService,
    PasswordCredentialsService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
