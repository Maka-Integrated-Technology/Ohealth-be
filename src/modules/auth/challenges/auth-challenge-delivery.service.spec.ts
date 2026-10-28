import { randomBytes } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { EmailService } from '../../email/email.service';
import { User } from '../../user/entities/user.entity';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';

describe('leased and encrypted authentication delivery', () => {
  const key = randomBytes(32).toString('base64');
  const challengeId = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
  const issued = { challengeId, code: '001234', expiresAt: new Date() };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(),
  };
  let transactionsActive = 0;
  const transaction = jest.fn(
    async (callback: (manager: EntityManager) => Promise<unknown>) => {
      transactionsActive++;
      try {
        return await callback(manager as unknown as EntityManager);
      } finally {
        transactionsActive--;
      }
    },
  );
  const issueInTransaction = jest.fn();
  const sendMail = jest.fn();
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
  const user = { id: '4b659a6c-9d3f-4cec-8122-2dccfae3095d' } as User;

  async function encryptedRow(
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    manager.query.mockResolvedValue([]);
    await service.queueInTransaction(
      manager as unknown as EntityManager,
      user,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const args = manager.query.mock.calls[0][1] as string[];
    manager.query.mockReset();
    return {
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
      ...overrides,
    };
  }

  function prepareClaim(row: Record<string, unknown> | null): void {
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT d.challenge_id')) return row ? [row] : [];
      if (sql.includes('RETURNING challenge_id'))
        return [{ challenge_id: challengeId }];
      return [];
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    transactionsActive = 0;
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

  it('rejects missing encryption key before creating the challenge', async () => {
    config.get.mockReturnValue(undefined);
    await expect(
      service.queueInTransaction(
        manager as unknown as EntityManager,
        user,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      ),
    ).rejects.toThrow('AUTH_CHALLENGE_DELIVERY_KEY');
    expect(issueInTransaction).not.toHaveBeenCalled();
  });

  it('requires a caller-owned transaction and only stores ciphertext', async () => {
    manager.queryRunner.isTransactionActive = false;
    await expect(
      service.queueInTransaction(
        manager as unknown as EntityManager,
        user,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      ),
    ).rejects.toThrow('database transaction');
    manager.queryRunner.isTransactionActive = true;
    const row = await encryptedRow();
    expect(row.ciphertext).toMatch(/^[a-f0-9]{12}$/);
    expect(row.iv).toMatch(/^[a-f0-9]{24}$/);
    expect(JSON.stringify(row)).not.toContain('001234');
  });

  it('commits the lease before sending and finalizes in a new transaction', async () => {
    const row = await encryptedRow();
    prepareClaim(row);
    sendMail.mockImplementation(async () => {
      expect(transactionsActive).toBe(0);
    });

    expect(await service.dispatchBatch(1)).toEqual({
      accepted: 1,
      retried: 0,
      discarded: 0,
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateData: expect.objectContaining({ code: '001234' }),
      }),
    );
    expect(transaction).toHaveBeenCalledTimes(2);
    const updates = manager.query.mock.calls.filter(([sql]) =>
      (sql as string).startsWith('UPDATE auth_challenge_deliveries'),
    );
    expect(updates).toHaveLength(2);
    expect(updates[0][0]).toContain("status = 'processing'");
    expect(updates[1][0]).toContain('lease_token = $2');
    expect(updates[1][0]).toContain('ciphertext = CASE');
  });

  it('does not hold the DB transaction while the provider is delayed', async () => {
    const row = await encryptedRow();
    prepareClaim(row);
    let releaseProvider: () => void = () => undefined;
    const provider = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    sendMail.mockImplementation(() => {
      expect(transactionsActive).toBe(0);
      return provider;
    });
    const pending = service.dispatchBatch(1);
    for (let i = 0; i < 8 && sendMail.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(transactionsActive).toBe(0);
    expect(transaction).toHaveBeenCalledTimes(1);
    releaseProvider();
    expect(await pending).toMatchObject({ accepted: 1 });
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('retries a provider outage without exposing the code to SQL', async () => {
    const row = await encryptedRow();
    prepareClaim(row);
    sendMail.mockRejectedValueOnce(new Error('provider unavailable'));
    expect(await service.dispatchBatch(1)).toEqual({
      accepted: 0,
      retried: 1,
      discarded: 0,
    });
    expect(JSON.stringify(manager.query.mock.calls)).not.toContain('001234');
    expect(JSON.stringify(manager.query.mock.calls)).not.toContain(
      'patient@example.test',
    );
  });

  it('discards expired challenges without sending mail', async () => {
    prepareClaim(
      await encryptedRow({ expires_at: new Date(Date.now() - 1000) }),
    );
    expect(await service.dispatchBatch(1)).toEqual({
      accepted: 0,
      retried: 0,
      discarded: 1,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses to report acceptance when lease fencing fails', async () => {
    prepareClaim(await encryptedRow());
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT d.challenge_id')) {
        return [
          {
            ...(await encryptedRow()),
          },
        ];
      }
      if (sql.includes('RETURNING challenge_id')) return [];
      return [];
    });
    // Override the SELECT separately; a stolen lease must never be finalized.
    const row = await encryptedRow();
    prepareClaim(row);
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT d.challenge_id')) return [row];
      if (sql.includes('RETURNING challenge_id')) return [];
      return [];
    });
    expect(await service.dispatchBatch(1)).toEqual({
      accepted: 0,
      retried: 0,
      discarded: 0,
    });
  });
});
