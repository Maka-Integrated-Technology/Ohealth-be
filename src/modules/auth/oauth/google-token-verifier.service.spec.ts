import { LoginTicket, OAuth2Client } from 'google-auth-library';

import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('GoogleTokenVerifierService', () => {
  const transactions = { hash: jest.fn((value: string) => `hash:${value}`) };
  const service = new GoogleTokenVerifierService(transactions as never);

  afterEach(() => jest.restoreAllMocks());

  function proof(payload: Record<string, unknown>) {
    (
      jest.spyOn(
        OAuth2Client.prototype,
        'verifyIdToken',
      ) as unknown as jest.Mock
    ).mockImplementation(
      async () =>
        ({
          getPayload: () => payload,
        }) as unknown as LoginTicket,
    );
  }

  it('accepts issuer, audience, authorized party, verified email and nonce together', async () => {
    proof({
      iss: 'https://accounts.google.com',
      sub: 'google-subject',
      aud: 'web-client-id',
      azp: 'web-client-id',
      nonce: 'bound-nonce',
      email: 'Person@Gmail.com',
      email_verified: true,
      given_name: 'Ada',
      family_name: 'Obi',
    });
    await expect(
      service.verify('signed-token', 'web-client-id', 'hash:bound-nonce'),
    ).resolves.toMatchObject({
      issuer: 'https://accounts.google.com',
      subject: 'google-subject',
      email: 'person@gmail.com',
    });
  });

  it.each([
    ['issuer', { iss: 'https://attacker.example' }],
    ['audience', { aud: 'other-client' }],
    ['authorized party', { azp: 'other-client' }],
    ['nonce', { nonce: 'other-nonce' }],
    ['verified email', { email_verified: false }],
    ['subject', { sub: undefined }],
  ])('rejects an invalid %s claim', async (_name, change) => {
    proof({
      iss: 'https://accounts.google.com',
      sub: 'google-subject',
      aud: 'web-client-id',
      azp: 'web-client-id',
      nonce: 'bound-nonce',
      email: 'person@gmail.com',
      email_verified: true,
      ...change,
    });
    await expect(
      service.verify('signed-token', 'web-client-id', 'hash:bound-nonce'),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_TOKEN_INVALID' });
  });

  it('maps provider/library failures to the stable token error', async () => {
    (
      jest.spyOn(
        OAuth2Client.prototype,
        'verifyIdToken',
      ) as unknown as jest.Mock
    ).mockImplementation(async () => {
      throw new Error('provider details must stay private');
    });
    await expect(
      service.verify('bad-token', 'web-client-id', 'hash:nonce'),
    ).rejects.toMatchObject({ errorCode: 'OAUTH_TOKEN_INVALID' });
  });
});
