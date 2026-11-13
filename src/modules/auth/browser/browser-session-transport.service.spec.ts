import { AuthService } from '../auth.service';
import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

import { BrowserSessionTransportService } from './browser-session-transport.service';

describe('BrowserSessionTransportService', () => {
  const session = {
    message: 'Login success',
    access_token: 'access-token',
    refresh_token: 'r'.repeat(43),
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    session_expires_at: new Date('2026-12-01T00:00:00Z'),
    user: {
      id: 'user-id',
      email: 'user@example.test',
      first_name: 'Test',
      last_name: 'User',
      role: ['PATIENT'],
    },
    routing_target: AuthRoutingTarget.PATIENT_HOME,
    access_level: AuthAccessLevel.FULL,
    verification_status: null,
  };
  const auth = {
    verifySignup: jest.fn(),
    verifyLogin: jest.fn(),
    refreshToken: jest.fn(),
    logoutByRefreshCredential: jest.fn(),
  } as unknown as AuthService;
  const service = new BrowserSessionTransportService(auth);

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
});
