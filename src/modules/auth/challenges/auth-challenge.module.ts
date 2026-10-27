import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../../email/email.module';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallenge } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([AuthChallenge])],
  providers: [
    AuthChallengeService,
    AuthChallengeDeliveryService,
    AuthRateLimitService,
  ],
  exports: [
    AuthChallengeService,
    AuthChallengeDeliveryService,
    AuthRateLimitService,
  ],
})
export class AuthChallengeModule {}
