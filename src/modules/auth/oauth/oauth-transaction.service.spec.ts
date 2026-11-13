import { ConfigService } from '@nestjs/config';

import { SignupIntent } from '../enums/signup-intent.enum';

import { OAuthTransaction } from './oauth-transaction.entity';
import { OAuthTransactionService } from './oauth-transaction.service';
import { OAuthConsumer, OAuthOperation } from './oauth.enums';

describe('OAuthTransactionService', () => {
  const repository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: '32f44e07-e744-460f-9900-35d1ee7695e6',
      ...value,
    })),
    findOne: jest.fn(),
  };
  const config: { get: jest.Mock } = {
    get: jest.fn((key: string) =>
      key === 'oauth.google.webClientIds'
        ? 'web-client-id'
        : 'mobile-client-id',
    ),
  };
  let service: OAuthTransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OAuthTransactionService(
      repository as never,
      config as unknown as ConfigService,
    );
  });

  it('stores only hashes while returning one-time proof material', async () => {
    const result = await service.start({
      operation: OAuthOperation.SIGNUP,
      consumer: OAuthConsumer.WEB,
      audience: 'web-client-id',
      intent: SignupIntent.PATIENT,
      acceptedTermsVersion: 'terms-v1',
      acceptedPrivacyVersion: 'privacy-v1',
    });
    expect(result.transaction_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.audience).toBe('web-client-id');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_token_hash: service.hash(result.transaction_token),
        nonce_hash: service.hash(result.nonce),
      }),
    );
    const stored = repository.create.mock.calls[0][0];
    expect(JSON.stringify(stored)).not.toContain(result.transaction_token);
    expect(JSON.stringify(stored)).not.toContain(result.nonce);
  });

  it('rejects invalid, expired and replayed transactions uniformly before use', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.load('missing', 'x'.repeat(43))).rejects.toMatchObject(
      {
        errorCode: 'OAUTH_TRANSACTION_INVALID',
      },
    );

    repository.findOne.mockResolvedValue({
      transaction_token_hash: service.hash('t'.repeat(43)),
      expires_at: new Date(Date.now() - 1),
      consumed_at: null,
    } as OAuthTransaction);
    await expect(service.load('expired', 't'.repeat(43))).rejects.toMatchObject(
      {
        errorCode: 'OAUTH_TRANSACTION_EXPIRED',
      },
    );

    repository.findOne.mockResolvedValue({
      transaction_token_hash: service.hash('t'.repeat(43)),
      expires_at: new Date(Date.now() + 60_000),
      consumed_at: new Date(),
    } as OAuthTransaction);
    await expect(
      service.load('replayed', 't'.repeat(43)),
    ).rejects.toMatchObject({
      errorCode: 'OAUTH_TRANSACTION_REPLAYED',
    });
  });

  it('rejects an audience outside the consumer allowlist', async () => {
    await expect(
      service.start({
        operation: OAuthOperation.SIGNIN,
        consumer: OAuthConsumer.WEB,
        audience: 'attacker-client-id',
      }),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_TRANSACTION_INVALID' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('atomically consumes a locked transaction', async () => {
    const transaction = {
      id: '32f44e07-e744-460f-9900-35d1ee7695e6',
      transaction_token_hash: service.hash('t'.repeat(43)),
      expires_at: new Date(Date.now() + 60_000),
      consumed_at: null,
    } as OAuthTransaction;
    const manager = {
      findOne: jest.fn().mockResolvedValue(transaction),
      save: jest.fn(async (value) => value),
    };
    await service.consumeInTransaction(
      manager as never,
      transaction.id,
      't'.repeat(43),
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      OAuthTransaction,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(transaction.consumed_at).toBeInstanceOf(Date);
    expect(manager.save).toHaveBeenCalledWith(transaction);
  });
});
