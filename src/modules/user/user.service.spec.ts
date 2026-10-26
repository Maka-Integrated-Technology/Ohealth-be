import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../auth/account-access-policy.service';
import { AuthSession } from '../auth/entities/auth.entity';

import { UserAccountStatusHistory } from './entities/user-account-status-history.entity';
import { User } from './entities/user.entity';
import { AccountStatus } from './enums/account-status.enum';
import { UserRole } from './enums/user-role.enum';
import { UserService } from './user.service';

describe('UserService atomic verification and audited state transitions', () => {
  const findOne = jest.fn();
  const save = jest.fn();
  const insert = jest.fn();
  const update = jest.fn();
  const repositoryUpdate = jest.fn();
  const manager = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
      fn({ findOne, save, insert, update }),
    ),
  };
  const policy = new AccountAccessPolicyService();
  const service = new UserService(
    { manager, update: repositoryUpdate } as unknown as Repository<User>,
    policy,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    save.mockImplementation(async (_entity: unknown, user: User) => user);
    update.mockResolvedValue({ affected: 1 });
    repositoryUpdate.mockResolvedValue({ affected: 1 });
  });

  it('updates status, contact time, legacy flags and audit in one transaction', async () => {
    const user = {
      id: 'user-1',
      email: 'verified@example.com',
      account_status: AccountStatus.PENDING_VERIFICATION,
      email_verified_at: null,
      is_active: false,
      is_verified: false,
      verification_code: '123456',
      verification_code_expires_at: new Date(Date.now() + 60_000),
    } as User;
    findOne.mockResolvedValue(user);
    await service.verifyEmailWithCode(user.email, '123456');
    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(user).toMatchObject({
      account_status: AccountStatus.ACTIVE,
      is_active: true,
      is_verified: true,
      verification_code: null,
      verification_code_expires_at: null,
    });
    expect(user.email_verified_at).toBeInstanceOf(Date);
    expect(insert).toHaveBeenCalledWith(
      UserAccountStatusHistory,
      expect.objectContaining({
        previous_status: AccountStatus.PENDING_VERIFICATION,
        new_status: AccountStatus.ACTIVE,
        reason: 'verified_email_code',
      }),
    );
  });

  it('rejects expired codes without writing an account or an audit record', async () => {
    findOne.mockResolvedValue({
      account_status: AccountStatus.PENDING_VERIFICATION,
      email_verified_at: null,
      verification_code: '123456',
      verification_code_expires_at: new Date(Date.now() - 10_000),
    });
    await expect(
      service.verifyEmailWithCode('pending@example.com', '123456'),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('prevents suspended accounts from self-reactivating via a verification code', async () => {
    findOne.mockResolvedValue({
      account_status: AccountStatus.SUSPENDED,
      email_verified_at: new Date(),
      verification_code: '123456',
      verification_code_expires_at: new Date(Date.now() + 10_000),
    });
    await expect(
      service.verifyEmailWithCode('blocked@example.com', '123456'),
    ).rejects.toThrow(ForbiddenException);
    expect(save).not.toHaveBeenCalled();
  });

  it('rotates a verification challenge under a row lock without writing lifecycle fields', async () => {
    const user = {
      id: 'pending-user',
      email: 'pending@example.com',
      account_status: AccountStatus.PENDING_VERIFICATION,
      email_verified_at: null,
    } as User;
    findOne.mockResolvedValue(user);
    const expiresAt = new Date(Date.now() + 60_000);

    await service.rotateVerificationChallenge(user.email, '654321', expiresAt);

    expect(findOne).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(update).toHaveBeenCalledWith(User, user.id, {
      verification_code: '654321',
      verification_code_expires_at: expiresAt,
    });
  });

  it('rejects a profile write when the locked current account is suspended', async () => {
    findOne.mockResolvedValue({
      id: 'suspended-user',
      account_status: AccountStatus.SUSPENDED,
      email_verified_at: new Date(),
    });

    await expect(
      service.updateAuthenticatedProfile('suspended-user', {
        first_name: 'Changed',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates only permitted profile fields after locking an active account', async () => {
    const user = {
      id: 'active-user',
      first_name: 'Old',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    } as User;
    findOne.mockResolvedValue(user);

    await service.updateAuthenticatedProfile(user.id, {
      first_name: 'New',
    });

    expect(update).toHaveBeenCalledWith(User, user.id, { first_name: 'New' });
    expect(update).not.toHaveBeenCalledWith(
      User,
      user.id,
      expect.objectContaining({ account_status: expect.anything() }),
    );
  });

  it('updates only reset-challenge fields without saving a stale user entity', async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    await service.setPasswordResetChallenge(
      'active-user',
      'reset-token',
      expiresAt,
    );

    expect(repositoryUpdate).toHaveBeenCalledWith('active-user', {
      reset_token: 'reset-token',
      reset_token_expiry: expiresAt,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('consumes a reset token under lock without changing account state', async () => {
    const user = {
      id: 'active-user',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      reset_token: 'reset-token',
      reset_token_expiry: new Date(Date.now() + 60_000),
    } as User;
    findOne.mockResolvedValue(user);

    await service.consumePasswordResetToken('reset-token', 'new-password');

    expect(findOne).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(update).toHaveBeenCalledWith(User, user.id, {
      password: 'new-password',
      reset_token: null,
      reset_token_expiry: null,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('revokes live sessions atomically within password reset', async () => {
    const user = {
      id: 'user-id-1',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      reset_token: 'reset-code',
      reset_token_expiry: new Date(Date.now() + 60_000),
    } as User;
    findOne.mockResolvedValue(user);
    await service.consumePasswordResetToken('reset-code', 'hashed-password');
    expect(update).toHaveBeenCalledWith(
      AuthSession,
      { user_id: user.id, revoked_at: IsNull() },
      { revoked_at: expect.any(Date) },
    );
    expect(manager.transaction).toHaveBeenCalledTimes(1);
  });

  it('logs a permitted administrative suspension with actor and reason', async () => {
    const user = {
      id: 'user-1',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      is_active: true,
      is_verified: true,
    } as User;
    findOne.mockImplementation(
      async (_entity: unknown, query: { where: { id: string } }) =>
        query.where.id === 'admin-1'
          ? {
              id: 'admin-1',
              role: [UserRole.ADMIN],
              account_status: AccountStatus.ACTIVE,
              email_verified_at: new Date(),
            }
          : user,
    );
    await service.transitionAccountStatus(
      user.id,
      AccountStatus.SUSPENDED,
      'admin-1',
      'security review',
    );
    expect(user.is_active).toBe(false);
    expect(insert).toHaveBeenCalledWith(
      UserAccountStatusHistory,
      expect.objectContaining({
        new_status: AccountStatus.SUSPENDED,
        changed_by_user_id: 'admin-1',
        reason: 'security review',
      }),
    );
  });
});
