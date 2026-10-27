import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../email/email.module';
import { UserPersona } from '../identity/entities/user-persona.entity';
import { LaboratoryAdmin } from '../laboratory/entities/laboratory-admin.entity';
import { LaboratoryStaff } from '../laboratory/entities/laboratory-staff.entity';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { OrganizationMembership } from '../organization/entities/organization-membership.entity';
import { Professional } from '../professional/entities/professional.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';

import { AuthRoutingService } from './auth-routing.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAbuseGuard } from './challenges/auth-abuse.guard';
import { AuthChallengeModule } from './challenges/auth-challenge.module';
import { CanonicalAuthContextService } from './context/canonical-auth-context.service';
import { AuthSession } from './entities/auth.entity';
import { User2fa } from './entities/user-2fa.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleLinkingService } from './oauth/google-linking.service';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { AuthSecurityAuditModule } from './security-audit/auth-security-audit.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
  imports: [
    AuthChallengeModule,
    AuthSecurityAuditModule,
    ConfigModule,
    EmailModule,
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      AuthSession,
      User2fa,
      Professional,
      User,
      UserPersona,
      OrganizationMembership,
      OrganizationAdmin,
      LaboratoryAdmin,
      LaboratoryStaff,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me'),
      }),
    }),
  ],
  controllers: [AuthController, TwoFactorAuthController],
  providers: [
    AuthService,
    AuthRoutingService,
    CanonicalAuthContextService,
    GoogleLinkingService,
    AuthAbuseGuard,
    PasswordCredentialsService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TwoFactorAuthService,
  ],
  exports: [
    AuthService,
    CanonicalAuthContextService,
    GoogleLinkingService,
    PasswordCredentialsService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
