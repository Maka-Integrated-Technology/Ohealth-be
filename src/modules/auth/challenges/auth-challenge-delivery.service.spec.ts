import { randomBytes } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { EmailService } from '../../email/email.service';
import { User } from '../../user/entities/user.entity';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';

describe('encrypted and recoverable auth challenge delivery', () => {
  const key = randomBytes(32).toString('base64');
  const challengeId = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
  const issued = {
    challengeId,
    code: '001234',
    expiresAt: new Date(Date.now() + 600000),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(),
  };
  const transaction = jest.fn(
    async (callback: (entityManager: EntityManager) => Promise<unknown>) =>
      callback(manager as unknown as EntityManager),
  );
  const issueInTransaction = jest.fn().mockResolvedValue(issued);
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const config = {
    get: jest.fn((name: string) => {
      if (name === 'AUTH_CHALLENGE_DELIVERY_KEY') return key;
      if (name === 'mail.from.address') return 'no-reply@ohealth.test';
      if (name === 'mail.from.name') return 'OHealth';
      if (name === 'app.name') return 'OHealth';
      return undefined;
    }),
  };
  const service = new AuthChallengeDeliveryService(
    { transaction } as unknown as DataSource,
    config as unknown as ConfigService,
    { issueInTransaction } as unknown as AuthChallengeService,
    { sendMail } as unknown as EmailService,
  );
  const user = {
    id: '4b659a6c-9d3f-4cec-8122-2dccfae3095d',
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.queryRunner.isTransactionActive = true;
    manager.query.mockResolvedValue([]);
    issueInTransaction.mockResolvedValue({
      ...issued,
      expiresAt: new Date(Date.now() + 600000),
    });
    sendMail.mockResolvedValue(undefined);
    config.get.mockImplementation((name: string) => {
      if (name === 'AUTH_CHALLENGE_DELIVERY_KEY') return key;
      if (name === 'mail.from.address') return 'no-reply@ohealth.test';
      if (name === 'mail.from.name') return 'OHealth';
      if (name === 'app.name') return 'OHealth';
      return undefined;
    });
  });

  it('refuses absent key before writing or invalidating any challenge', async () => {
    config.get.mockReturnValue(undefined);
    await expect(
      service.queueInTransaction(
        manager as unknown as EntityManager,
        user,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      ),
    ).rejects.toThrow('AUTH_CHALLENGE_DELIVERY_KEY');
    expect(issueInTransaction).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('requires a real database transaction', async () => {
    manager.queryRunner.isTransactionActive = false;
    await expect(
      service.queueInTransaction(
        manager as unknown as EntityManager,
        user,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      ),
    ).rejects.toThrow('database transaction');
  });

  it('stores only an authenticated encrypted envelope and returns safe metadata', async () => {
    const receipt = await service.queueInTransaction(
      manager as unknown as EntityManager,
      user,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );

    expect(receipt.challengeId).toBe(challengeId);
    expect(receipt.resendAfterSeconds).toBe(60);
    expect(receipt.expiresInSeconds).toBeGreaterThan(0);
    expect(receipt).not.toHaveProperty('code');
    expect(issueInTransaction).toHaveBeenCalledWith(
      manager,
      user.id,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const args = manager.query.mock.calls[0][1] as string[];
    expect(args[0]).toBe(challengeId);
    expect(args[1]).toMatch(/^[a-f0-9]{24}$/);
    expect(args[2]).toMatch(/^[a-f0-9]{12}$/);
    expect(args[3]).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(args)).not.toContain('001234');
    expect(JSON.stringify(args)).not.toContain('no-reply@ohealth.test');
  });

  it('decrypts only in worker memory and clears the envelope after provider acceptance', async () => {
    await service.queueInTransaction(
      manager as unknown as EntityManager,
      user,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const args = manager.query.mock.calls[0][1] as string[];
    manager.query.mockReset().mockResolvedValueOnce([
      {
        challenge_id: challengeId,
        iv: args[1],
        ciphertext: args[2],
        tag: args[3],
        purpose: AuthChallengePurpose.CONTACT_VERIFICATION,
        expires_at: new Date(Date.now() + 600000),
        consumed_at: null,
        email: 'patient@example.test',
        first_name: 'Ada',
        attempts: 0,
      },
    ]);

    const result = await service.dispatchBatch(1);

    expect(result).toEqual({ accepted: 1, retried: 0, discarded: 0 });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateData: expect.objectContaining({ code: '001234' }),
      }),
    );
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining('ciphertext = NULL'),
      [challengeId, 'accepted'],
    );
  });

  it('does not report acceptance or leak plaintext on provider failure', async () => {
    manager.query.mockResolvedValueOnce([
      {
        challenge_id: challengeId,
        iv: '0'.repeat(24),
        ciphertext: '0'.repeat(12),
        tag: '0'.repeat(32),
        purpose: AuthChallengePurpose.CONTACT_VERIFICATION,
        expires_at: new Date(Date.now() + 600000),
        consumed_at: null,
        email: 'patient@example.test',
        first_name: 'Ada',
        attempts: 0,
      },
    ]);
    const result = await service.dispatchBatch(1);
    expect(result).toEqual({ accepted: 0, retried: 1, discarded: 0 });
    expect(sendMail).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining('attempts = attempts + 1'),
      [challengeId, true],
    );
  });

  it('retries provider rejection without marking delivery as accepted', async () => {
    await service.queueInTransaction(
      manager as unknown as EntityManager,
      user,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const args = manager.query.mock.calls[0][1] as string[];
    manager.query.mockReset().mockResolvedValueOnce([
      {
        challenge_id: challengeId,
        iv: args[1],
        ciphertext: args[2],
        tag: args[3],
        purpose: AuthChallengePurpose.CONTACT_VERIFICATION,
        expires_at: new Date(Date.now() + 600000),
        consumed_at: null,
        email: 'patient@example.test',
        first_name: 'Ada',
        attempts: 0,
      },
    ]);
    sendMail.mockRejectedValueOnce(new Error('provider unavailable'));

    expect(await service.dispatchBatch(1)).toEqual({
      accepted: 0,
      retried: 1,
      discarded: 0,
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining('attempts = attempts + 1'),
      [challengeId, true],
    );
    expect(JSON.stringify(manager.query.mock.calls)).not.toContain('001234');
    expect(JSON.stringify(manager.query.mock.calls)).not.toContain(
      'patient@example.test',
    );
  });

  it('discards an expired challenge without contacting the provider', async () => {
    manager.query.mockResolvedValueOnce([
      {
        challenge_id: challengeId,
        expires_at: new Date(Date.now() - 1000),
        consumed_at: null,
      },
    ]);
    expect(await service.dispatchBatch(1)).toEqual({
      accepted: 0,
      retried: 0,
      discarded: 1,
    });
    expect(sendMail).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining('ciphertext = NULL'),
      [challengeId, 'discarded'],
    );
  });
});
