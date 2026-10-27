import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { DataSource } from 'typeorm';

import { AccountStatus } from '../../user/enums/account-status.enum';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';

import { GoogleLinkingService } from './google-linking.service';

describe('GoogleLinkingService explicit-link boundary', () => {
  const account = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.com',
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    google_id: null as string | null,
  };
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    queryRunner: { isTransactionActive: true },
  };
  const database = {
    transaction: jest.fn(async (fn: (manager: unknown) => Promise<unknown>) =>
      fn(manager),
    ),
  };
  const config = {
    get: jest.fn((name: string) => {
      if (name === 'GOOGLE_CLIENT_ID') return 'google-client-id';
      if (name === 'REGISTRATION_TERMS_VERSION') return 'terms-v3';
      if (name === 'REGISTRATION_PRIVACY_VERSION') return 'privacy-v4';
      return undefined;
    }),
  };
  const audit = { recordInTransaction: jest.fn() };
  const recent = jest.fn().mockResolvedValue(undefined);
  const service = new GoogleLinkingService(
    database as unknown as DataSource,
    config as unknown as ConfigService,
    new AccountAccessPolicyService(),
    audit as unknown as AuthSecurityAuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue({ ...account });
    manager.find.mockResolvedValue([
      { document_type: 'terms_of_service', document_version: 'terms-v3' },
      { document_type: 'privacy_policy', document_version: 'privacy-v4' },
    ]);
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async () => ({
      getPayload: () => ({
        sub: 'google-subject-1',
        email: 'ada@example.com',
        email_verified: true,
        nonce: 'server-initiated-nonce',
      }),
    } as unknown as LoginTicket));
  });

  afterEach(() => jest.restoreAllMocks());

  it('requires recent authentication before verifying a Google proof', async () => {
    await expect(
      service.link(
        account.id,
        'signed-token',
        'server-initiated-nonce',
        async () => {
          throw new UnauthorizedException('Old session');
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(manager.update).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('links only a verified same-email Google subject with legal consent and audit', async () => {
    await service.link(
      account.id,
      'signed-token',
      'server-initiated-nonce',
      recent,
    );
    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      account.id,
      { google_id: 'google-subject-1' },
    );
    expect(audit.recordInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        event_type: 'oauth_link',
        subject_user_id: account.id,
      }),
    );
  });

  it('rejects mismatched nonce or unverified provider evidence', async () => {
    await expect(
      service.link(account.id, 'signed-token', 'wrong-nonce', recent),
    ).rejects.toThrow(UnauthorizedException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects linking a blocked account and does not audit success', async () => {
    manager.findOne.mockResolvedValue({
      ...account,
      account_status: AccountStatus.SUSPENDED,
    });
    await expect(
      service.link(
        account.id,
        'signed-token',
        'server-initiated-nonce',
        recent,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(manager.update).not.toHaveBeenCalled();
    expect(audit.recordInTransaction).not.toHaveBeenCalled();
  });

  it('does not link when accepted legal evidence is missing', async () => {
    manager.find.mockResolvedValue([]);
    await expect(
      service.link(
        account.id,
        'signed-token',
        'server-initiated-nonce',
        recent,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects different already-linked provider subjects', async () => {
    manager.findOne.mockResolvedValue({
      ...account,
      google_id: 'another-subject',
    });
    await expect(
      service.link(
        account.id,
        'signed-token',
        'server-initiated-nonce',
        recent,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('turns concurrent provider-subject uniqueness violations into controlled conflicts', async () => {
    manager.update.mockRejectedValueOnce({ code: '23505' });
    await expect(
      service.link(
        account.id,
        'signed-token',
        'server-initiated-nonce',
        recent,
      ),
    ).rejects.toThrow(ConflictException);
    expect(audit.recordInTransaction).not.toHaveBeenCalled();
  });

  it('supports identical retries without duplicated audit events', async () => {
    manager.findOne.mockResolvedValue({
      ...account,
      google_id: 'google-subject-1',
    });
    await service.link(
      account.id,
      'signed-token',
      'server-initiated-nonce',
      recent,
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(audit.recordInTransaction).not.toHaveBeenCalled();
  });
});
