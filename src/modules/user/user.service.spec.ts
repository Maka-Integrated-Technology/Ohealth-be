import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../auth/account-access-policy.service';
import { PlatformPrivilegeEntity } from '../auth/context/platform-privilege.entity';

import { UserAccountStatusHistory } from './entities/user-account-status-history.entity';
import { User } from './entities/user.entity';
import { AccountStatus } from './enums/account-status.enum';
import { UserService } from './user.service';

describe('UserService canonical administrative state transitions', () => {
  const actor = {
    id: 'admin-id',
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    role: [],
  } as User & { role: string[] };
  const subject = {
    id: 'subject-id',
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    is_active: true,
    is_verified: true,
  } as User;
  const findOne = jest.fn();
  const save = jest.fn(async (_entity: unknown, value: User) => value);
  const insert = jest.fn();
  const manager = {
    transaction: jest.fn(
      async (operation: (manager: unknown) => Promise<unknown>) =>
        operation({ findOne, save, insert }),
    ),
  };
  const service = new UserService(
    { manager } as unknown as Repository<User>,
    new AccountAccessPolicyService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    actor.role = [];
    subject.account_status = AccountStatus.ACTIVE;
    subject.is_active = true;
    findOne.mockImplementation(
      async (entity: unknown, query: { where: { id?: string } }) => {
        if (entity === PlatformPrivilegeEntity)
          return { user_id: actor.id, privilege: 'admin' };
        return query.where.id === actor.id ? actor : subject;
      },
    );
  });

  it('uses the platform privilege record even when the actor has no legacy role', async () => {
    await service.transitionAccountStatus(
      subject.id,
      AccountStatus.SUSPENDED,
      actor.id,
      'security review',
    );
    expect(subject.is_active).toBe(false);
    expect(insert).toHaveBeenCalledWith(
      UserAccountStatusHistory,
      expect.objectContaining({
        changed_by_user_id: actor.id,
        new_status: AccountStatus.SUSPENDED,
        reason: 'security review',
      }),
    );
  });

  it('denies a forged legacy admin role when no platform privilege exists', async () => {
    actor.role = ['ADMIN' as never];
    findOne.mockImplementation(
      async (entity: unknown, query: { where: { id?: string } }) => {
        if (entity === PlatformPrivilegeEntity) return null;
        return query.where.id === actor.id ? actor : subject;
      },
    );
    await expect(
      service.transitionAccountStatus(
        subject.id,
        AccountStatus.SUSPENDED,
        actor.id,
        'security review',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(save).not.toHaveBeenCalled();
  });
});
