import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from '../user/user.module';

import { AuthSession } from './entities/auth.entity';
import { RefreshCredential } from './entities/refresh-credential.entity';
import { RefreshSessionService } from './refresh-session.service';
import { AuthSecurityAuditModule } from './security-audit/auth-security-audit.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    AuthSecurityAuditModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([AuthSession, RefreshCredential]),
  ],
  providers: [RefreshSessionService],
  exports: [RefreshSessionService],
})
export class RefreshSessionModule {}
