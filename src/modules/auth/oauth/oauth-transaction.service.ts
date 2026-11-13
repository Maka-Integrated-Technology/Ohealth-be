import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { SignupIntent } from '../enums/signup-intent.enum';

import { OAuthTransaction } from './oauth-transaction.entity';
import { OAuthConsumer, OAuthOperation, OAuthProvider } from './oauth.enums';
import { OAuthException } from './oauth.error';

const TTL_SECONDS = 300;

export interface IStartOAuthTransactionInput {
  operation: OAuthOperation;
  consumer: OAuthConsumer;
  audience: string;
  intent?: SignupIntent;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  userId?: string;
}

@Injectable()
export class OAuthTransactionService {
  constructor(
    @InjectRepository(OAuthTransaction)
    private readonly repository: Repository<OAuthTransaction>,
    private readonly config: ConfigService,
  ) {}

  async start(input: IStartOAuthTransactionInput) {
    const audience = this.audienceFor(input.consumer, input.audience);
    const transactionToken = this.randomSecret();
    const nonce = this.randomSecret();
    const transaction = await this.repository.save(
      this.repository.create({
        provider: OAuthProvider.GOOGLE,
        operation: input.operation,
        consumer: input.consumer,
        audience,
        transaction_token_hash: this.hash(transactionToken),
        nonce_hash: this.hash(nonce),
        intent: input.intent ?? null,
        accepted_terms_version: input.acceptedTermsVersion ?? null,
        accepted_privacy_version: input.acceptedPrivacyVersion ?? null,
        user_id: input.userId ?? null,
        expires_at: new Date(Date.now() + TTL_SECONDS * 1000),
        consumed_at: null,
      }),
    );
    return {
      transaction_id: transaction.id,
      transaction_token: transactionToken,
      nonce,
      audience,
      expires_in_seconds: TTL_SECONDS,
    };
  }

  async load(id: string, token: string): Promise<OAuthTransaction> {
    const transaction = await this.repository.findOne({ where: { id } });
    this.assertUsable(transaction, token);
    return transaction!;
  }

  async consumeInTransaction(
    manager: EntityManager,
    id: string,
    token: string,
  ): Promise<OAuthTransaction> {
    const transaction = await manager.findOne(OAuthTransaction, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    this.assertUsable(transaction, token);
    transaction!.consumed_at = new Date();
    await manager.save(transaction!);
    return transaction!;
  }

  hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private assertUsable(
    transaction: OAuthTransaction | null,
    token: string,
  ): void {
    if (
      !transaction ||
      !this.matches(token, transaction.transaction_token_hash)
    ) {
      throw new OAuthException('OAUTH_TRANSACTION_INVALID');
    }
    if (transaction.consumed_at) {
      throw new OAuthException('OAUTH_TRANSACTION_REPLAYED');
    }
    if (transaction.expires_at <= new Date()) {
      throw new OAuthException('OAUTH_TRANSACTION_EXPIRED');
    }
  }

  private audienceFor(consumer: OAuthConsumer, requested: string): string {
    const key =
      consumer === OAuthConsumer.WEB
        ? 'oauth.google.webClientIds'
        : 'oauth.google.mobileClientIds';
    const configured = this.config.get<string>(key) ?? '';
    const audiences = configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!requested || !audiences.includes(requested)) {
      throw new OAuthException('OAUTH_TRANSACTION_INVALID');
    }
    return requested;
  }

  private matches(raw: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(raw), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private randomSecret(): string {
    return randomBytes(32).toString('base64url');
  }
}
