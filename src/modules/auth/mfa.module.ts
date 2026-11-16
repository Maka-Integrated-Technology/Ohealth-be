import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../user/entities/user.entity';

import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { User2fa } from './entities/user-2fa.entity';
import { MfaSecretBox } from './mfa-secret-box';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { AuthSecurityAuditModule } from './security-audit/auth-security-audit.module';
import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
  imports: [
    ConfigModule,
    AuthSecurityAuditModule,
    TypeOrmModule.forFeature([User, User2fa, MfaRecoveryCode]),
  ],
  providers: [MfaSecretBox, PasswordCredentialsService, TwoFactorAuthService],
  exports: [TwoFactorAuthService],
})
export class MfaModule {}
