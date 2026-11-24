import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from '../../user/user.module';
import { AuthSession } from '../entities/auth.entity';
import { RefreshCredential } from '../entities/refresh-credential.entity';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AuthSecurityAuditModule } from '../security-audit/auth-security-audit.module';

import { RefreshSessionService } from './refresh-session.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([AuthSession, RefreshCredential]),
    UserModule,
    AuthSecurityAuditModule,
  ],
  providers: [RefreshSessionService, PasswordCredentialsService],
  exports: [RefreshSessionService],
})
export class RefreshSessionModule {}
