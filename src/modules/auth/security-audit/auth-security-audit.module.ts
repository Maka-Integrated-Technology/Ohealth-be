import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthSecurityAuditService } from './auth-security-audit.service';
import { AuthSecurityEvent } from './auth-security-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuthSecurityEvent])],
  providers: [AuthSecurityAuditService],
  exports: [AuthSecurityAuditService],
})
export class AuthSecurityAuditModule {}
