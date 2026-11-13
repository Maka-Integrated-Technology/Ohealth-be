import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    start: jest.fn(),
    load: jest.fn(),
    consumeInTransaction: jest.fn(),
  };
  const verifier = { verify: jest.fn() };
  const sessions = { issueInTransaction: jest.fn() };
  const routing = { resolve: jest.fn() };
  const passwords = { hashGeneratedSecret: jest.fn() };
  const provisioning = { provisionPersonaAndLegalIdentity: jest.fn() };
  const delivery = { queueInTransaction: jest.fn() };
  const audit = {
    recordInTransaction: jest.fn(),
    recordAttempt: jest.fn(),
  };
  let service: OAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
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
    provisioning.provisionPersonaAndLegalIdentity.mockImplementation(
      async (_manager: unknown, input: Record<string, unknown>) => ({
        id: 'new-user',
        ...input,
        first_name: input.firstName,
        last_name: input.lastName,
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
      .mockResolvedValueOnce({ user_id: user.id })
      .mockResolvedValueOnce(user);
    await expect(service.complete(transactionDto)).resolves.toMatchObject({
      access_token: 'access-token',
      routing_target: 'patient_home',
      user: { id: 'linked-user' },
    });
    expect(sessions.issueInTransaction).toHaveBeenCalledWith(manager, user.id);
  });

  it('prevents a Google-only user from unlinking the final authenticator', async () => {
    const recentSession = {
      created_at: new Date(),
    };
    dataSource.getRepository.mockReturnValue({
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockResolvedValue(recentSession),
    });
    manager.findOne.mockResolvedValueOnce({
      id: 'google-only-user',
      password_authentication_enabled: false,
    });
    manager.find.mockResolvedValueOnce([{ id: 'google-identity' }]);

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
    manager.findOne.mockResolvedValueOnce({
      id: 'dual-auth-user',
      password_authentication_enabled: true,
    });
    manager.find.mockResolvedValueOnce([{ id: 'google-identity' }]);

    await expect(
      service.unlink('dual-auth-user', 'b606d7d3-54de-4c10-9bb1-f734fa66a801'),
    ).resolves.toEqual({ message: 'Google identity unlinked.' });
    expect(manager.delete).toHaveBeenCalledWith(ExternalIdentity, {
      user_id: 'dual-auth-user',
      provider: 'google',
    });
  });

  it('rejects a provider subject conflict during explicit linking', async () => {
    const transaction = {
      operation: OAuthOperation.LINK,
      audience: 'web-client-id',
      nonce_hash: 'nonce-hash',
      user_id: 'current-user',
    };
    transactions.load.mockResolvedValue(transaction);
    transactions.consumeInTransaction.mockResolvedValue(transaction);
    manager.findOne
      .mockResolvedValueOnce({ id: 'current-user' })
      .mockResolvedValueOnce({ user_id: 'different-user' });
    await expect(service.complete(transactionDto)).rejects.toMatchObject({
      errorCode: 'OAUTH_IDENTITY_CONFLICT',
    });
    expect(manager.insert).not.toHaveBeenCalled();
  });
});
