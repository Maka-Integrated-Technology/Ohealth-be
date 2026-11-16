import { AuthService } from '../auth.service';
import { OAuthConsumer } from '../oauth/oauth.enums';
import { OAuthService } from '../oauth/oauth.service';

import { BrowserSessionTransportService } from './browser-session-transport.service';

describe('BrowserSessionTransportService', () => {
  const session = {
    message: 'Login success',
    access_token: 'access-token',
    refresh_token: 'r'.repeat(43),
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    session_expires_at: new Date('2026-12-01T00:00:00Z'),
    account_context: { account: { id: 'user-id' }, capabilities: [] },
  };
  const auth = {
    verifySignup: jest.fn(),
    verifyLogin: jest.fn(),
    refreshToken: jest.fn(),
    logoutByRefreshCredential: jest.fn(),
  } as unknown as AuthService;
  const oauth = { complete: jest.fn() } as unknown as OAuthService;
  const service = new BrowserSessionTransportService(auth, oauth);

  beforeEach(() => jest.clearAllMocks());

  it.each(['verifySignup', 'verifyLogin'] as const)(
    'structurally strips the refresh credential from %s',
    async (method) => {
      (auth[method] as jest.Mock).mockResolvedValue({ ...session });
      const result = await service[method]({
        challenge_id: '550e8400-e29b-41d4-a716-446655440000',
        code: '123456',
      });
      expect(result.refreshCredential).toBe(session.refresh_token);
      expect(result.response).not.toHaveProperty('refresh_token');
      expect(JSON.stringify(result.response)).not.toContain(
        session.refresh_token,
      );
    },
  );

  it('keeps the mobile refresh body contract at the shared auth boundary', async () => {
    (auth.refreshToken as jest.Mock).mockResolvedValue({ ...session });
    const result = await service.refresh(session.refresh_token);
    expect(auth.refreshToken).toHaveBeenCalledWith({
      refresh_token: session.refresh_token,
    });
    expect(result.response).not.toHaveProperty('refresh_token');
    expect(result.refreshCredential).toBe(session.refresh_token);
  });

  it('delegates browser logout to canonical credential revocation', async () => {
    (auth.logoutByRefreshCredential as jest.Mock).mockResolvedValue({
      message: 'logout success',
    });
    await expect(service.logout(session.refresh_token)).resolves.toEqual({
      message: 'logout success',
    });
    expect(auth.logoutByRefreshCredential).toHaveBeenCalledWith(
      session.refresh_token,
    );
  });

  it('binds Google completion to web and strips a resulting session credential', async () => {
    (oauth.complete as jest.Mock).mockResolvedValue({ ...session });
    const payload = {
      transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
      transaction_token: 't'.repeat(43),
      id_token: 'google-id-token',
    };

    const result = await service.completeGoogle(payload);

    expect(oauth.complete).toHaveBeenCalledWith(payload, OAuthConsumer.WEB);
    expect(result).toMatchObject({
      issuedSession: true,
      refreshCredential: session.refresh_token,
    });
    expect(result.response).not.toHaveProperty('refresh_token');
  });

  it('passes through Google contact-verification continuation without a cookie credential', async () => {
    const continuation = {
      message: 'Contact verification required.',
      error_code: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
      challenge_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    };
    (oauth.complete as jest.Mock).mockResolvedValue(continuation);

    await expect(
      service.completeGoogle({
        transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
        transaction_token: 't'.repeat(43),
        id_token: 'google-id-token',
      }),
    ).resolves.toEqual({ issuedSession: false, response: continuation });
  });
});
