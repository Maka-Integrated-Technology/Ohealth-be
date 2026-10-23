import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountAccessPolicyService } from '../auth/account-access-policy.service';

import { UserAccountStatusHistory } from './entities/user-account-status-history.entity';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserAccountStatusHistory])],
  providers: [UserService, AccountAccessPolicyService],
  exports: [TypeOrmModule, UserService, AccountAccessPolicyService],
})
export class UserModule {}
