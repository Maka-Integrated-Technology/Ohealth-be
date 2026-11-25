import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../../email/email.module';
import { EmailDestinationService } from '../email-change/email-destination';
import { AuthSecurityAuditModule } from '../security-audit/auth-security-audit.module';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallenge } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Module({
  imports: [
    EmailModule,
    AuthSecurityAuditModule,
    TypeOrmModule.forFeature([AuthChallenge]),
  ],
  providers: [
    AuthChallengeService,
    AuthChallengeDeliveryService,
    AuthRateLimitService,
    EmailDestinationService,
  ],
  exports: [
    AuthChallengeService,
    AuthChallengeDeliveryService,
    AuthRateLimitService,
    EmailDestinationService,
  ],
})
export class AuthChallengeModule {}
