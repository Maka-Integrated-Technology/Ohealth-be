import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { SignupIntent } from '../enums/signup-intent.enum';

import { ExternalIdentity } from './external-identity.entity';
import { OAuthConsumer, OAuthOperation } from './oauth.enums';
import { OAuthException } from './oauth.error';
import { OAuthService } from './oauth.service';

const transactionDto = {
  transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
  transaction_token: 't'.repeat(43),
  id_token: 'google-token',
};

describe('OAuthService', () => {
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (_entity, value) => ({ id: 'new-user', ...value })),
    create: jest.fn((_entity, value) => value),
    insert: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (value: typeof manager) => unknown) =>
      work(manager),
    ),
    getRepository: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'registration.termsVersion' ? 'terms-v1' : 'privacy-v1',
    ),
  };
  const transactions = {
    assertReady: jest.fn(),
    start: jest.fn(),
    load: jest.fn(),
    consumeInTransaction: jest.fn(),
  };
  const verifier = { verify: jest.fn() };
  const sessions = {
    issueInTransaction: jest.fn(),
    revokeAllInTransaction: jest.fn(),
  };
  const routing = { resolve: jest.fn() };
  const passwords = { hashGeneratedSecret: jest.fn() };
  const provisioning = { provisionPersonaAndLegalIdentity: jest.fn() };
  const delivery = { queueInTransaction: jest.fn() };
  const audit = {
    recordInTransaction: jest.fn(),
    recordAttempt: jest.fn(),
  };
  const accountPolicy = { assertCanAuthenticate: jest.fn() };
  let service: OAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.getRepository.mockReset();
    manager.findOne.mockReset();
    manager.find.mockReset();
    accountPolicy.assertCanAuthenticate.mockReset();
    service = new OAuthService(
      dataSource as never,
      config as unknown as ConfigService,
      transactions as never,
      verifier as never,
      sessions as never,
      routing as never,
      passwords as never,
      provisioning as never,
      delivery as never,
      audit as never,
      accountPolicy as never,
    );
    const preview = {
      operation: OAuthOperation.SIGNIN,
      audience: 'web-client-id',
      nonce_hash: 'nonce-hash',
    };
    transactions.load.mockResolvedValue(preview);
    transactions.consumeInTransaction.mockResolvedValue(preview);
    verifier.verify.mockResolvedValue({
      issuer: 'https://accounts.google.com',
      subject: 'google-subject',
      email: 'person@gmail.com',
      emailVerified: true,
    });
    sessions.issueInTransaction.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      session_id: 'b606d7d3-54de-4c10-9bb1-f734fa66a801',
      session_expires_at: new Date(),
    });
    routing.resolve.mockResolvedValue({ routing_target: 'patient_home' });
    manager.delete.mockResolvedValue({ affected: 1 });
    provisioning.provisionPersonaAndLegalIdentity.mockImplementation(
      async (_manager: unknown, input: Record<string, unknown>) => ({
        id: 'new-user',
        ...input,
        first_name: input.firstName,
        last_name: input.lastName,
      }),
    );
  });

  it('binds a linking transaction to the current recent session', async () => {
    const sessionId = 'b606d7d3-54de-4c10-9bb1-f734fa66a801';
    dataSource.getRepository.mockImplementation((entity) => ({
      findOne: jest.fn().mockResolvedValue(
        entity === User
          ? {
              id: 'current-user',
              account_status: AccountStatus.ACTIVE,
              email_verified_at: new Date(),
            }
          : {
              user_id: 'current-user',
              session_id: sessionId,
              created_at: new Date(),
              expires_at: new Date(Date.now() + 60_000),
              credential_version: 2,
              revoked_at: null,
            },
      ),
    }));
    await service.startLink(
      'current-user',
      sessionId,
      OAuthConsumer.WEB,
      'web-client-id',
    );
    expect(transactions.start).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: OAuthOperation.LINK,
        userId: 'current-user',
        sessionId,
      }),
    );
  });

  it.each([
    SignupIntent.PHARMACY,
    SignupIntent.LABORATORY,
    SignupIntent.HOSPITAL,
  ])('rejects unsupported Google signup intent %s', async (intent) => {
    await expect(
      service.start({
        operation: OAuthOperation.SIGNUP,
        consumer: OAuthConsumer.WEB,
        audience: 'web-client-id',
        intent,
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
      }),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_INTENT_NOT_SUPPORTED' });
    expect(transactions.start).not.toHaveBeenCalled();
  });

  it('binds current legal versions and intent into signup start', async () => {
    transactions.start.mockResolvedValue({ transaction_id: 'transaction' });
    await service.start({
      operation: OAuthOperation.SIGNUP,
      consumer: OAuthConsumer.WEB,
      audience: 'web-client-id',
      intent: SignupIntent.PATIENT,
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    });
    expect(transactions.start).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: OAuthOperation.SIGNUP,
        intent: SignupIntent.PATIENT,
        acceptedTermsVersion: 'terms-v1',
        acceptedPrivacyVersion: 'privacy-v1',
      }),
    );
  });

  it('rejects stale legal versions before creating a transaction', async () => {
    await expect(
      service.start({
        operation: OAuthOperation.SIGNUP,
        consumer: OAuthConsumer.WEB,
        audience: 'web-client-id',
        intent: SignupIntent.PATIENT,
        accepted_terms_version: 'old',
        accepted_privacy_version: 'privacy-v1',
      }),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_LEGAL_VERSION_STALE' });
  });

  it('creates canonical patient, legal and identity records for authoritative signup', async () => {
    const signup = {
      operation: OAuthOperation.SIGNUP,
      audience: 'web-client-id',
      nonce_hash: 'nonce-hash',
      intent: SignupIntent.PATIENT,
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    };
    transactions.load.mockResolvedValue(signup);
    transactions.consumeInTransaction.mockResolvedValue(signup);
    verifier.verify.mockResolvedValue({
      issuer: 'https://accounts.google.com',
      subject: 'new-google-subject',
      email: 'new.patient@gmail.com',
      emailVerified: true,
      givenName: 'New',
      familyName: 'Patient',
    });
    manager.findOne.mockResolvedValueOnce(null);
    manager.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    passwords.hashGeneratedSecret.mockResolvedValue('generated-secret-hash');

    await expect(service.complete(transactionDto)).resolves.toMatchObject({
      access_token: 'access-token',
      user: { id: 'new-user', email: 'new.patient@gmail.com' },
    });
    expect(manager.insert).toHaveBeenCalledWith(
      ExternalIdentity,
      expect.objectContaining({ subject: 'new-google-subject' }),
    );
    expect(provisioning.provisionPersonaAndLegalIdentity).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        personaType: 'patient',
        passwordAuthenticationEnabled: false,
        acceptedTermsVersion: 'terms-v1',
        acceptedPrivacyVersion: 'privacy-v1',
      }),
    );
    expect(sessions.issueInTransaction).toHaveBeenCalledWith(
      manager,
      'new-user',
    );
  });

  it('continues non-authoritative signup to contact verification without a session', async () => {
    const signup = {
      operation: OAuthOperation.SIGNUP,
      audience: 'web-client-id',
      nonce_hash: 'nonce-hash',
      intent: SignupIntent.HEALTHCARE_PROFESSIONAL,
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    };
    transactions.load.mockResolvedValue(signup);
    transactions.consumeInTransaction.mockResolvedValue(signup);
    verifier.verify.mockResolvedValue({
      issuer: 'https://accounts.google.com',
      subject: 'third-party-subject',
      email: 'professional@example.com',
      emailVerified: true,
      givenName: 'Pro',
      familyName: 'User',
    });
    manager.findOne.mockResolvedValueOnce(null);
    manager.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    passwords.hashGeneratedSecret.mockResolvedValue('generated-secret-hash');
    delivery.queueInTransaction.mockResolvedValue({
      challengeId: '17d36477-ae70-4ac6-b557-d584bc840ad1',
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    });

    await expect(service.complete(transactionDto)).resolves.toMatchObject({
      error_code: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
      challenge_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
    });
    expect(sessions.issueInTransaction).not.toHaveBeenCalled();
    expect(delivery.queueInTransaction).toHaveBeenCalled();
    expect(provisioning.provisionPersonaAndLegalIdentity).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        personaType: 'healthcare_professional',
      }),
    );
  });

  it('claims the one-time transaction before validating provider proof', async () => {
    verifier.verify.mockRejectedValueOnce(
      new OAuthException('OAUTH_TOKEN_INVALID'),
    );
    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_TOKEN_INVALID',
    });
    expect(transactions.consumeInTransaction).toHaveBeenCalledTimes(1);
    expect(audit.recordAttempt).toHaveBeenCalled();
  });

  it('never links an unknown subject by email during sign-in', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    manager.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'email-owner' }),
    });
    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_ACCOUNT_LINK_REQUIRED',
    });
    expect(manager.insert).not.toHaveBeenCalledWith(
      ExternalIdentity,
      expect.anything(),
    );
    expect(sessions.issueInTransaction).not.toHaveBeenCalled();
  });

  it('returns signup-required for an unknown subject and email', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    manager.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_SIGNUP_REQUIRED',
    });
  });

  it.each([
    AccountStatus.PENDING_VERIFICATION,
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
  ])('fails closed for a linked %s account', async (accountStatus) => {
    manager.findOne
      .mockResolvedValueOnce({ user_id: 'blocked-user' })
      .mockResolvedValueOnce({
        id: 'blocked-user',
        account_status: accountStatus,
        email_verified_at: new Date(),
      });
    sessions.issueInTransaction.mockRejectedValueOnce(
      new UnauthorizedException('blocked'),
    );

    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_AUTHENTICATION_FAILED',
    });
    expect(audit.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied' }),
    );
  });

  it('issues through the canonical session service for a linked active user', async () => {
    const user = {
      id: 'linked-user',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      email: 'person@gmail.com',
      first_name: 'Person',
      last_name: 'User',
    };
    manager.findOne
      .mockResolvedValueOnce({ id: 'identity-id', user_id: user.id })
      .mockResolvedValueOnce(user);
    await expect(service.complete(transactionDto)).resolves.toMatchObject({
      access_token: 'access-token',
      routing_target: 'patient_home',
      user: { id: 'linked-user' },
    });
    expect(sessions.issueInTransaction).toHaveBeenCalledWith(manager, user.id);
    expect(manager.update).toHaveBeenCalledWith(
      ExternalIdentity,
      expect.anything(),
      expect.objectContaining({ last_authenticated_at: expect.any(Date) }),
    );
  });

  it('prevents a Google-only user from unlinking the final authenticator', async () => {
    const recentSession = {
      created_at: new Date(),
    };
    dataSource.getRepository.mockReturnValue({
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockResolvedValue(recentSession),
    });
    manager.findOne
      .mockResolvedValueOnce({
        id: 'google-only-user',
        password_authentication_enabled: false,
      })
      .mockResolvedValueOnce({
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
        credential_version: 2,
      });
    manager.find.mockResolvedValueOnce([
      { id: 'google-identity', provider: 'google' },
    ]);

    await expect(
      service.unlink(
        'google-only-user',
        'b606d7d3-54de-4c10-9bb1-f734fa66a801',
      ),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_LAST_AUTHENTICATOR' });
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('allows unlink after the user establishes password authentication', async () => {
    dataSource.getRepository.mockReturnValue({
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockResolvedValue({ created_at: new Date() }),
    });
    manager.findOne
      .mockResolvedValueOnce({
        id: 'dual-auth-user',
        password_authentication_enabled: true,
      })
      .mockResolvedValueOnce({
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
        credential_version: 2,
      });
    manager.find.mockResolvedValueOnce([
      { id: 'google-identity', provider: 'google' },
    ]);

    await expect(
      service.unlink('dual-auth-user', 'b606d7d3-54de-4c10-9bb1-f734fa66a801'),
    ).resolves.toEqual({ message: 'Google identity unlinked.' });
    expect(manager.delete).toHaveBeenCalledWith(ExternalIdentity, {
      user_id: 'dual-auth-user',
      provider: 'google',
    });
    expect(sessions.revokeAllInTransaction).toHaveBeenCalledWith(
      manager,
      'dual-auth-user',
    );
    expect(manager.insert).toHaveBeenCalledWith(
      OutboxEvent,
      expect.objectContaining({
        event_type: 'oauth_google_unlinked',
        payload: { user_id: 'dual-auth-user' },
      }),
    );
    expect(JSON.stringify(manager.insert.mock.calls)).not.toContain(
      'google-token',
    );
  });

  it('rejects a provider subject conflict during explicit linking', async () => {
    const transaction = {
      operation: OAuthOperation.LINK,
      audience: 'web-client-id',
      nonce_hash: 'nonce-hash',
      user_id: 'current-user',
      session_id: 'b606d7d3-54de-4c10-9bb1-f734fa66a801',
    };
    transactions.load.mockResolvedValue(transaction);
    transactions.consumeInTransaction.mockResolvedValue(transaction);
    manager.findOne
      .mockResolvedValueOnce({ id: 'current-user', email: 'person@gmail.com' })
      .mockResolvedValueOnce({
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
        credential_version: 2,
      })
      .mockResolvedValueOnce({ user_id: 'different-user' });
    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_IDENTITY_CONFLICT',
    });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('rejects a different Google email during explicit linking', async () => {
    const transaction = {
      operation: OAuthOperation.LINK,
      audience: 'web-client-id',
      nonce_hash: 'nonce-hash',
      user_id: 'current-user',
      session_id: 'b606d7d3-54de-4c10-9bb1-f734fa66a801',
    };
    transactions.load.mockResolvedValue(transaction);
    transactions.consumeInTransaction.mockResolvedValue(transaction);
    verifier.verify.mockResolvedValue({
      issuer: 'https://accounts.google.com',
      subject: 'subject',
      email: 'other@gmail.com',
      emailVerified: true,
    });
    manager.findOne
      .mockResolvedValueOnce({
        id: 'current-user',
        email: 'person@gmail.com',
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
      })
      .mockResolvedValueOnce({
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
        credential_version: 2,
      });
    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_ACCOUNT_LINK_REQUIRED',
    });
    expect(manager.insert).not.toHaveBeenCalledWith(
      ExternalIdentity,
      expect.anything(),
    );
  });

  it.each(['suspended', 'revoked'] as const)(
    'rejects link completion after %s intervenes',
    async (cause) => {
      const transaction = {
        operation: OAuthOperation.LINK,
        audience: 'web-client-id',
        nonce_hash: 'nonce-hash',
        user_id: 'current-user',
        session_id: 'b606d7d3-54de-4c10-9bb1-f734fa66a801',
      };
      transactions.load.mockResolvedValue(transaction);
      transactions.consumeInTransaction.mockResolvedValue(transaction);
      manager.findOne
        .mockResolvedValueOnce({
          id: 'current-user',
          email: 'person@gmail.com',
          account_status:
            cause === 'suspended'
              ? AccountStatus.SUSPENDED
              : AccountStatus.ACTIVE,
          email_verified_at: new Date(),
        })
        .mockResolvedValueOnce({
          created_at: new Date(),
          expires_at: new Date(Date.now() + 60_000),
          credential_version: 2,
          revoked_at: cause === 'revoked' ? new Date() : null,
        });
      if (cause === 'suspended')
        accountPolicy.assertCanAuthenticate.mockImplementationOnce(() => {
          throw new UnauthorizedException();
        });
      await expect(service.complete(transactionDto)).rejects.toMatchObject({
        errorCode:
          cause === 'suspended'
            ? 'OAUTH_AUTHENTICATION_FAILED'
            : 'OAUTH_RECENT_AUTH_REQUIRED',
      });
      expect(manager.insert).not.toHaveBeenCalledWith(
        ExternalIdentity,
        expect.anything(),
      );
    },
  );

  it('does not audit a successful unlink for a missing Google identity', async () => {
    manager.findOne
      .mockResolvedValueOnce({
        id: 'dual-auth-user',
        password_authentication_enabled: true,
      })
      .mockResolvedValueOnce({
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
        credential_version: 2,
      });
    manager.find.mockResolvedValueOnce([]);
    await expect(
      service.unlink('dual-auth-user', 'b606d7d3-54de-4c10-9bb1-f734fa66a801'),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_IDENTITY_CONFLICT' });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(sessions.revokeAllInTransaction).not.toHaveBeenCalled();
  });
});
