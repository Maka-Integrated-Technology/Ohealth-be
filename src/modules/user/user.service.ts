import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';
import { AccountAccessPolicyService } from '../auth/account-access-policy.service';
import { PlatformPrivilegeEntity } from '../auth/context/platform-privilege.entity';
import { PlatformPrivilege } from '../auth/context/platform-privilege.enum';

import { UserAccountStatusHistory } from './entities/user-account-status-history.entity';
import { User } from './entities/user.entity';
import { AccountStatus } from './enums/account-status.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly accountAccessPolicy: AccountAccessPolicyService,
  ) {}

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  /** An internal-only path; callers cannot select a new status themselves.
   * No unauthenticated or self-service state-change HTTP endpoint is exposed.
   */
  async transitionAccountStatus(
    userId: string,
    target: AccountStatus,
    actorId: string,
    reason: string,
  ): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const actor = await manager.findOne(User, { where: { id: actorId } });
      if (!actor) {
        throw new NotFoundException(sysMsg.USER_NOT_FOUND);
      }
      this.accountAccessPolicy.assertCanAuthenticate(actor);
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException(sysMsg.USER_NOT_FOUND);
      }
      const privilege = await manager.findOne(PlatformPrivilegeEntity, {
        where: { user_id: actorId, privilege: PlatformPrivilege.ADMIN },
      });
      this.accountAccessPolicy.assertAdminTransition(
        user.account_status,
        target,
        Boolean(privilege),
        reason,
        Boolean(user.email_verified_at),
      );
      const previous = user.account_status;
      user.account_status = target;
      user.is_active = target === AccountStatus.ACTIVE;
      user.is_verified = Boolean(user.email_verified_at);
      const saved = await manager.save(User, user);
      await manager.insert(UserAccountStatusHistory, {
        user_id: user.id,
        previous_status: previous,
        new_status: target,
        changed_by_user_id: actor.id,
        reason: reason.trim(),
      });
      return saved;
    });
  }
}
