import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { UserAccountStatusHistory } from '../../user/entities/user-account-status-history.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthSession } from '../entities/auth.entity';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import { AuthSecurityEventType } from '../security-audit/auth-security-event.enum';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';
import { SecureAuthChallengeFlowsService } from './secure-auth-challenge-flows.service';

const ID = '4b659a6c-9d3f-4cec-8122-2dccfae3095d';
const CHALLENGE = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
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
  const dataSourceQuery = jest.fn();
  const assertLiveFlowReady = jest.fn();
  const queueInTransaction = jest.fn().mockResolvedValue({
    challengeId: CHALLENGE,
    resendAfterSeconds: 60,
    expiresInSeconds: 600,
  });
  const replaceInTransaction = jest.fn().mockResolvedValue({
    challengeId: CHALLENGE,
    resendAfterSeconds: 60,
    expiresInSeconds: 600,
  });
  const recordInTransaction = jest.fn().mockResolvedValue(undefined);
  const recordAttempt = jest.fn().mockResolvedValue(undefined);
  const issueInTransaction = jest.fn().mockResolvedValue({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    session_id: '25b45bce-c76b-4a3b-b96f-18a28d825f92',
    session_expires_at: new Date('2026-11-12T12:00:00.000Z'),
  });
  const consumeWithMutation = jest.fn(
    async (
      _challengeId: string,
      _purpose: AuthChallengePurpose,
      _code: string,
      callback: (manager: EntityManager, userId: string) => Promise<unknown>,
    ) => callback(manager as unknown as EntityManager, ID),
  );
  const service = new SecureAuthChallengeFlowsService(
    { transaction, query: dataSourceQuery } as unknown as DataSource,
    {
      queueInTransaction,
      replaceInTransaction,
      assertLiveFlowReady,
    } as unknown as AuthChallengeDeliveryService,
    { consumeWithMutation } as unknown as AuthChallengeService,
    new AccountAccessPolicyService(),
    {
      recordInTransaction,
      recordAttempt,
    } as unknown as AuthSecurityAuditService,
    { issueInTransaction } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    assertLiveFlowReady.mockReset();
    // Reset one-off answers as well as call counts between matrix cases.
    manager.query.mockReset().mockResolvedValue([]);
    dataSourceQuery.mockReset().mockResolvedValue([]);
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
    replaceInTransaction.mockReset().mockResolvedValue({
      challengeId: CHALLENGE,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    });
    recordInTransaction.mockResolvedValue(undefined);
    recordAttempt.mockResolvedValue(undefined);
    issueInTransaction.mockClear();
    consumeWithMutation.mockImplementation(
      async (_challengeId, _purpose, _code, callback) =>
        callback(manager as unknown as EntityManager, ID),
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
    expect(result.user.account_status).toBe(AccountStatus.ACTIVE);
    expect(result.user.email_verified_at).toBeInstanceOf(Date);
    expect(result.session.access_token).toBe('access-token');
    expect(issueInTransaction).toHaveBeenCalledWith(manager, ID);
    expect(manager.insert).toHaveBeenCalledWith(
      UserAccountStatusHistory,
      expect.objectContaining({
        user_id: ID,
        new_status: AccountStatus.ACTIVE,
      }),
    );
  });

  it('queues a purpose-bound login challenge after revalidating the password proof', async () => {
    const active = {
      ...user,
      password: 'current-password-hash',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      is_active: true,
      is_verified: true,
    } as User;
    manager.findOne.mockResolvedValueOnce(active);

    const result = await service.requestLogin(active);

    expect(result).toMatchObject({
      challenge_id: CHALLENGE,
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    });
    expect(queueInTransaction).toHaveBeenCalledWith(
      manager,
      active,
      AuthChallengePurpose.LOGIN_VERIFICATION,
    );
    expect(recordInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        event_type: AuthSecurityEventType.LOGIN_CHALLENGE_REQUEST,
      }),
    );
  });

  it('consumes login proof and creates the session in the same transaction', async () => {
    const active = {
      ...user,
      password: 'current-password-hash',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      is_active: true,
      is_verified: true,
    } as User;
    manager.findOne.mockResolvedValueOnce(active);

    const result = await service.verifyLogin(CHALLENGE, '123456');

    expect(consumeWithMutation).toHaveBeenCalledWith(
      CHALLENGE,
      AuthChallengePurpose.LOGIN_VERIFICATION,
      '123456',
      expect.any(Function),
    );
    expect(issueInTransaction).toHaveBeenCalledWith(manager, ID);
    expect(result).toMatchObject({
      user: { id: ID },
      session: { access_token: 'access-token' },
    });
  });

  it('records expired login proof distinctly without exposing a different response', async () => {
    consumeWithMutation.mockRejectedValueOnce(
      new BadRequestException('Invalid or expired authentication challenge.'),
    );
    dataSourceQuery.mockResolvedValueOnce([
      {
        purpose: AuthChallengePurpose.LOGIN_VERIFICATION,
        subject_user_id: ID,
        expires_at: new Date(Date.now() - 1_000),
      },
    ]);

    await expect(service.verifyLogin(CHALLENGE, '123456')).rejects.toThrow(
      'Invalid or expired authentication challenge.',
    );
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: AuthSecurityEventType.LOGIN_CHALLENGE_EXPIRY,
        subject_user_id: ID,
      }),
    );
  });

  it('audits rejection when account state changes before login verification', async () => {
    consumeWithMutation.mockRejectedValueOnce(
      new UnauthorizedException('User is inactive.'),
    );
    dataSourceQuery.mockResolvedValueOnce([
      {
        purpose: AuthChallengePurpose.LOGIN_VERIFICATION,
        subject_user_id: ID,
        expires_at: new Date(Date.now() + 60_000),
      },
    ]);

    await expect(service.verifyLogin(CHALLENGE, '123456')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: AuthSecurityEventType.LOGIN_CHALLENGE_VERIFICATION,
        subject_user_id: ID,
      }),
    );
  });

  it('audits unavailable login delivery as an infrastructure failure', async () => {
    const active = {
      ...user,
      password: 'current-password-hash',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    } as User;
    assertLiveFlowReady.mockRejectedValueOnce(new Error('worker unavailable'));

    await expect(service.requestLogin(active)).rejects.toThrow(
      'temporarily unavailable',
    );
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failed',
        subject_user_id: ID,
      }),
    );
  });

  it('returns a stable delivery-unavailable code when durable queuing fails', async () => {
    const active = {
      ...user,
      password: 'current-password-hash',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      is_active: true,
      is_verified: true,
    } as User;
    manager.findOne.mockResolvedValueOnce(active);
    queueInTransaction.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.requestLogin(active)).rejects.toMatchObject({
      response: {
        error_code: 'AUTH_CHALLENGE_DELIVERY_UNAVAILABLE',
        retry_after_seconds: 30,
      },
      status: 503,
    });
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failed' }),
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
        password_authentication_enabled: true,
        reset_token: null,
      }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      AuthSession,
      expect.objectContaining({ user_id: ID }),
      expect.objectContaining({ revoked_at: expect.any(Date) }),
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auth_challenges'),
      [ID, AuthChallengePurpose.LOGIN_VERIFICATION, 'administratively_revoked'],
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

  it('replaces contact verification by opaque handle and returns continuation', async () => {
    manager.query.mockResolvedValueOnce([{ subject_user_id: ID }]);
    const response = await service.resendContact(CHALLENGE);
    expect(replaceInTransaction).toHaveBeenCalledWith(
      manager,
      CHALLENGE,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    expect(response).toMatchObject({ challenge_id: CHALLENGE });
  });

  it('replaces recovery by opaque handle only for an active verified account', async () => {
    manager.query.mockResolvedValueOnce([{ subject_user_id: ID }]);
    manager.findOne.mockResolvedValueOnce({
      ...user,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    });
    await service.resendRecovery(CHALLENGE);
    expect(replaceInTransaction).toHaveBeenCalledWith(
      manager,
      CHALLENGE,
      AuthChallengePurpose.PASSWORD_RECOVERY,
    );
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
        'temporarily unavailable',
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
      'temporarily unavailable',
    );
    expect(manager.query).not.toHaveBeenCalled();
  });
});
