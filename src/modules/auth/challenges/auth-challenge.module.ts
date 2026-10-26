import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthChallenge } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthChallenge])],
  providers: [AuthChallengeService, AuthRateLimitService],
  exports: [AuthChallengeService, AuthRateLimitService],
})
export class AuthChallengeModule {}
