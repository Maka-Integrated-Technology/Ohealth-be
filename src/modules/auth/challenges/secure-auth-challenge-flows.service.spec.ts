import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { UserAccountStatusHistory } from '../../user/entities/user-account-status-history.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { UserRole } from '../../user/enums/user-role.enum';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthDto } from '../dto/auth.dto';
import { AuthSession } from '../entities/auth.entity';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';
import { SecureAuthChallengeFlowsService } from './secure-auth-challenge-flows.service';

const ID = '4b659a6c-9d3f-4cec-8122-2dccfae3095d';
const CHALLENGE = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
const dto: AuthDto = {
  email: ' ADA@Example.test ',
  first_name: ' Ada ',
  last_name: ' Okafor ',
  password: 'a sufficiently long passphrase',
  role: [UserRole.PATIENT],
};

describe('SecureAuthChallengeFlowsService', () => {
  const user: User = {
    id: ID,
    email: 'ada@example.test',
    account_status: AccountStatus.PENDING_VERIFICATION,
    email_verified_at: null,
    is_active: false,
    is_verified: false,
  } as User;
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => ({
      ...value,
      id: ID,
    })),
    insert: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn(),
  };
  const transaction = jest.fn(
    async (cb: (manager: EntityManager) => Promise<unknown>) =>
      cb(manager as unknown as EntityManager),
  );
  const assertLiveFlowReady = jest.fn();
  const queueInTransaction = jest.fn().mockResolvedValue({
    challengeId: CHALLENGE,
    resendAfterSeconds: 60,
    expiresInSeconds: 600,
  });
  const recordInTransaction = jest.fn().mockResolvedValue(undefined);
  const consumeWithMutation = jest.fn(
    async (
      _challengeId: string,
      _purpose: AuthChallengePurpose,
      _code: string,
      callback: (manager: EntityManager, userId: string) => Promise<unknown>,
    ) => callback(manager as unknown as EntityManager, ID),
  );
  const service = new SecureAuthChallengeFlowsService(
    { transaction } as unknown as DataSource,
    {
      queueInTransaction,
      assertLiveFlowReady,
    } as unknown as AuthChallengeDeliveryService,
    { consumeWithMutation } as unknown as AuthChallengeService,
    new AccountAccessPolicyService(),
    { recordInTransaction } as unknown as AuthSecurityAuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    assertLiveFlowReady.mockReset();
    // Reset one-off answers as well as call counts between matrix cases.
    manager.query.mockReset().mockResolvedValue([]);
    manager.findOne.mockReset().mockResolvedValue({ ...user });
    manager.save.mockImplementation(async (_entity, value) => ({
      ...value,
      id: ID,
    }));
    queueInTransaction.mockReset().mockResolvedValue({
      challengeId: CHALLENGE,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    });
    recordInTransaction.mockResolvedValue(undefined);
    consumeWithMutation.mockImplementation(
      async (_challengeId, _purpose, _code, callback) =>
        callback(manager as unknown as EntityManager, ID),
    );
  });

  it('creates a pending account and queues the challenge in one transaction without legacy codes', async () => {
    const result = await service.signup(dto, 'approved-hash');
    expect(result.challengeId).toBe(CHALLENGE);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        email: 'ada@example.test',
        password: 'approved-hash',
        verification_code: null,
        reset_token: null,
      }),
    );
    expect(queueInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: ID }),
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    expect(recordInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ subject_user_id: ID }),
    );
  });

  it('rejects duplicate normalized email before any identity or challenge writes', async () => {
    manager.query.mockResolvedValueOnce([{ id: ID }]);
    await expect(service.signup(dto, 'approved-hash')).rejects.toThrow(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(queueInTransaction).not.toHaveBeenCalled();
  });

  it('rejects concurrent unique conflicts with a controlled response', async () => {
    manager.save.mockRejectedValueOnce({ code: '23505' });
    await expect(service.signup(dto, 'approved-hash')).rejects.toThrow(
      ConflictException,
    );
  });

  it('requires challenge delivery to be transactionally queued before returning signup success', async () => {
    queueInTransaction.mockRejectedValueOnce(
      new Error('encrypted delivery unavailable'),
    );
    await expect(service.signup(dto, 'approved-hash')).rejects.toThrow(
      'encrypted delivery unavailable',
    );
  });

  it('uses purpose-bound single-use consumption before activating and auditing a user', async () => {
    const result = await service.verifyContact(CHALLENGE, '123456');
    expect(consumeWithMutation).toHaveBeenCalledWith(
      CHALLENGE,
      AuthChallengePurpose.CONTACT_VERIFICATION,
      '123456',
      expect.any(Function),
    );
    expect(result.account_status).toBe(AccountStatus.ACTIVE);
    expect(result.email_verified_at).toBeInstanceOf(Date);
    expect(manager.insert).toHaveBeenCalledWith(
      UserAccountStatusHistory,
      expect.objectContaining({
        user_id: ID,
        new_status: AccountStatus.ACTIVE,
      }),
    );
  });

  it('refuses activation of a suspended account', async () => {
    manager.findOne.mockResolvedValueOnce({
      ...user,
      account_status: AccountStatus.SUSPENDED,
    });
    await expect(service.verifyContact(CHALLENGE, '123456')).rejects.toThrow();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('changes password, revokes existing sessions and audits within challenge consumption', async () => {
    manager.findOne.mockResolvedValueOnce({
      ...user,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    });
    await service.completeRecovery(CHALLENGE, '123456', 'new-secret-hash');
    expect(consumeWithMutation).toHaveBeenCalledWith(
      CHALLENGE,
      AuthChallengePurpose.PASSWORD_RECOVERY,
      '123456',
      expect.any(Function),
    );
    expect(manager.update).toHaveBeenCalledWith(
      User,
      ID,
      expect.objectContaining({
        password: 'new-secret-hash',
        reset_token: null,
      }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      AuthSession,
      expect.objectContaining({ user_id: ID }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    );
    expect(recordInTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED])(
    'refuses recovery after account state changed to %s',
    async (status) => {
      manager.findOne.mockResolvedValueOnce({
        ...user,
        account_status: status,
        email_verified_at: new Date(),
      });
      await expect(
        service.completeRecovery(CHALLENGE, '123456', 'new-secret-hash'),
      ).rejects.toThrow();
      expect(manager.update).not.toHaveBeenCalled();
      expect(recordInTransaction).not.toHaveBeenCalled();
    },
  );

  it('returns the same resend response for unknown, active and pending accounts', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    const unknown = await service.resend('ada@example.test');
    manager.findOne.mockResolvedValueOnce({
      ...user,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    });
    const active = await service.resend('ada@example.test');
    const pending = await service.resend('ada@example.test');
    expect(unknown).toEqual(active);
    expect(active).toEqual(pending);
    expect(queueInTransaction).toHaveBeenCalledTimes(1);
  });

  it('fails identically for unknown and known email when delivery encryption is unconfigured', async () => {
    assertLiveFlowReady.mockImplementation(() => {
      throw new Error('Challenge encryption unavailable');
    });
    await expect(service.resend('ghost@example.test')).rejects.toThrow(
      'Challenge encryption unavailable',
    );
    await expect(service.requestRecovery('ada@example.test')).rejects.toThrow(
      'Challenge encryption unavailable',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not reissue on an active resend cooldown', async () => {
    manager.query.mockResolvedValueOnce([{ issued_at: new Date() }]);
    await service.resend('ada@example.test');
    expect(queueInTransaction).not.toHaveBeenCalled();
  });

  it('does not disclose unknown accounts during recovery requests', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    const unknown = await service.requestRecovery('ghost@example.test');
    manager.findOne.mockResolvedValueOnce({
      ...user,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    });
    const known = await service.requestRecovery('ada@example.test');
    expect(known).toEqual(unknown);
    expect(queueInTransaction).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['unknown', null],
    ['pending', { ...user }],
    [
      'active',
      {
        ...user,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      },
    ],
    ['suspended', { ...user, account_status: AccountStatus.SUSPENDED }],
    ['deactivated', { ...user, account_status: AccountStatus.DEACTIVATED }],
  ])(
    'checks full worker readiness before inspecting %s account eligibility',
    async (_label, account) => {
      assertLiveFlowReady.mockRejectedValueOnce(
        new Error('Auth challenge delivery worker is not healthy.'),
      );
      manager.findOne.mockResolvedValueOnce(account);
      await expect(service.requestRecovery('ada@example.test')).rejects.toThrow(
        'worker is not healthy',
      );
      expect(manager.findOne).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(queueInTransaction).not.toHaveBeenCalled();
    },
  );

  it('uses the same readiness boundary for cooldown and unknown recovery', async () => {
    assertLiveFlowReady.mockRejectedValueOnce(new Error('worker unavailable'));
    manager.query.mockResolvedValueOnce([{ issued_at: new Date() }]);
    await expect(service.requestRecovery('ada@example.test')).rejects.toThrow(
      'worker unavailable',
    );
    expect(manager.query).not.toHaveBeenCalled();
  });

  it.each([
    ['resend', AccountStatus.PENDING_VERIFICATION, false, true],
    ['resend', AccountStatus.ACTIVE, true, false],
    ['resend', AccountStatus.SUSPENDED, true, false],
    ['recovery', AccountStatus.ACTIVE, true, true],
    ['recovery', AccountStatus.PENDING_VERIFICATION, false, false],
    ['recovery', AccountStatus.SUSPENDED, true, false],
    ['recovery', AccountStatus.DEACTIVATED, true, false],
  ])(
    'treats a healthy worker consistently on %s for %s accounts',
    async (endpoint, status, verified, shouldQueue) => {
      manager.findOne.mockResolvedValueOnce({
        ...user,
        account_status: status,
        email_verified_at: verified ? new Date() : null,
      });
      const response =
        endpoint === 'resend'
          ? await service.resend('ada@example.test')
          : await service.requestRecovery('ada@example.test');
      expect(response.message).toContain('queued');
      expect(assertLiveFlowReady).toHaveBeenCalledTimes(1);
      expect(queueInTransaction).toHaveBeenCalledTimes(shouldQueue ? 1 : 0);
    },
    10000,
  );

  it('never queues a healthy account inside the 60-second cooldown', async () => {
    manager.query.mockResolvedValueOnce([{ issued_at: new Date() }]);
    await service.resend('ada@example.test');
    expect(assertLiveFlowReady).toHaveBeenCalledTimes(1);
    expect(queueInTransaction).not.toHaveBeenCalled();
  });

  it('checks live readiness before a signup transaction', async () => {
    assertLiveFlowReady.mockRejectedValueOnce(new Error('worker unavailable'));
    await expect(service.signup(dto, 'approved-hash')).rejects.toThrow(
      'worker unavailable',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
