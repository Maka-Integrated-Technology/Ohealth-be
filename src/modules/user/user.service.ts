import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';
import { AccountAccessPolicyService } from '../auth/account-access-policy.service';

import { UserAccountStatusHistory } from './entities/user-account-status-history.entity';
import { User } from './entities/user.entity';
import { AccountStatus } from './enums/account-status.enum';
import {
  AuthenticatedUserProfileUpdate,
  IGoogleIdentityProfile,
} from './interfaces/user-mutation.interface';

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

  async setPasswordResetChallenge(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      reset_token: token,
      reset_token_expiry: expiresAt,
    });
  }

  async consumePasswordResetToken(
    token: string,
    password: string,
  ): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { reset_token: token },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !user ||
        !user.reset_token_expiry ||
        user.reset_token_expiry < new Date()
      ) {
        throw new BadRequestException(sysMsg.TOKEN_INVALID);
      }
      this.accountAccessPolicy.assertKnownStatus(user.account_status);

      await manager.update(User, user.id, {
        password,
        reset_token: null,
        reset_token_expiry: null,
      });
      user.password = password;
      user.reset_token = null;
      user.reset_token_expiry = null;
      return user;
    });
  }

  async rotateVerificationChallenge(
    email: string,
    code: string,
    expiresAt: Date,
  ): Promise<User | null> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { email },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        return null;
      }
      this.accountAccessPolicy.assertCanVerifyContact(user);
      await manager.update(User, user.id, {
        verification_code: code,
        verification_code_expires_at: expiresAt,
      });
      user.verification_code = code;
      user.verification_code_expires_at = expiresAt;
      return user;
    });
  }

  async updateAuthenticatedProfile(
    userId: string,
    update: AuthenticatedUserProfileUpdate,
  ): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await this.findLockedAuthenticatedUser(manager, userId);
      if (Object.keys(update).length) {
        await manager.update(User, user.id, update);
        Object.assign(user, update);
      }
      return user;
    });
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

  /** Email code validation, status change and history entry are one transaction.
   * The row lock prevents two valid-code requests from activating twice.
   */
  async verifyEmailWithCode(email: string, code: string): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { email },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException(sysMsg.USER_NOT_FOUND);
      }
      this.accountAccessPolicy.assertCanVerifyContact(user);
      if (
        !user.verification_code ||
        !user.verification_code_expires_at ||
        user.verification_code !== code
      ) {
        throw new BadRequestException(sysMsg.INVALID_VERIFICATION_CODE);
      }
      const now = new Date();
      if (user.verification_code_expires_at < now) {
        throw new BadRequestException(sysMsg.VERIFICATION_CODE_EXPIRED);
      }

      const previous = user.account_status;
      user.account_status = AccountStatus.ACTIVE;
      user.email_verified_at = now;
      user.is_active = true;
      user.is_verified = true;
      user.verification_code = null;
      user.verification_code_expires_at = null;
      const saved = await manager.save(User, user);
      await manager.insert(UserAccountStatusHistory, {
        user_id: user.id,
        previous_status: previous,
        new_status: AccountStatus.ACTIVE,
        changed_by_user_id: null,
        reason: 'verified_email_code',
      });
      return saved;
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
      this.accountAccessPolicy.assertAdminTransition(
        user.account_status,
        target,
        actor.role ?? [],
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
