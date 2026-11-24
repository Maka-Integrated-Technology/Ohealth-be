import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';
import { AccountAccessPolicyService } from '../auth/account-access-policy.service';
import { PlatformPrivilegeEntity } from '../auth/context/platform-privilege.entity';
import { PlatformPrivilege } from '../auth/context/platform-privilege.enum';

import { UserAccountStatusHistory } from './entities/user-account-status-history.entity';
import { User } from './entities/user.entity';
import { AccountStatus } from './enums/account-status.enum';
import { IGoogleIdentityProfile } from './interfaces/user-mutation.interface';

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

  async create(payload: DeepPartial<User>) {
    const user = this.userRepository.create(payload);
    return this.userRepository.save(user);
  }

  async replaceAuthenticatedPassword(
    userId: string,
    expectedPassword: string,
    password: string,
  ): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await this.findLockedAuthenticatedUser(manager, userId);
      if (user.password !== expectedPassword) {
        throw new UnauthorizedException(sysMsg.INVALID_CURRENT_PASSWORD);
      }
      await manager.update(User, user.id, { password });
      user.password = password;
      return user;
    });
  }

  async linkGoogleIdentity(
    userId: string,
    googleId: string,
    profile: IGoogleIdentityProfile,
  ): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await this.findLockedAuthenticatedUser(manager, userId);
      if (user.google_id && user.google_id !== googleId) {
        throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
      }

      const update: Partial<
        Pick<User, 'google_id' | 'first_name' | 'last_name'>
      > = {};
      if (!user.google_id) {
        update.google_id = googleId;
      }
      if (!user.first_name || user.first_name === 'OHealth') {
        update.first_name = profile.firstName;
      }
      if (!user.last_name || user.last_name === 'User') {
        update.last_name = profile.lastName;
      }
      if (Object.keys(update).length) {
        await manager.update(User, user.id, update);
        Object.assign(user, update);
      }
      return user;
    });
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

  private async findLockedAuthenticatedUser(
    manager: EntityManager,
    userId: string,
  ): Promise<User> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) {
      throw new NotFoundException(sysMsg.USER_NOT_FOUND);
    }
    this.accountAccessPolicy.assertCanAuthenticate(user);
    return user;
  }
}
