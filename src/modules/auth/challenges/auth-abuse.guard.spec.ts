import { ExecutionContext, HttpException } from '@nestjs/common';

import { AuthAbuseGuard } from './auth-abuse.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthAbuseGuard', () => {
  const consume = jest.fn();
  const guard = new AuthAbuseGuard({
    consume,
  } as unknown as AuthRateLimitService);
  const context = (path: string, body: Record<string, unknown>, ip: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          route: { path },
          body,
          socket: { remoteAddress: ip },
          headers: Object.fromEntries([['x-forwarded-for', '1.2.3.4']]),
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    consume.mockReset().mockResolvedValue({
      allowed: true,
      hits: 1,
      retryAfterSeconds: 0,
    });
  });

  it('uses the socket peer instead of spoofable forwarding headers', async () => {
    await guard.canActivate(
      context('/login', { email: 'Test@Example.com' }, '127.0.0.1'),
    );
    expect(consume).toHaveBeenCalledWith('/auth/login', 'ip:127.0.0.1', 20, 60);
    expect(consume).toHaveBeenCalledWith(
      '/auth/login',
      'subject:test@example.com',
      8,
      60,
    );
    expect(JSON.stringify(consume.mock.calls)).not.toContain('1.2.3.4');
  });

  it('recognizes routes mounted under the global API prefix', async () => {
    await guard.canActivate(
      context('/api/auth/login', { email: 'test@example.com' }, '127.0.0.1'),
    );
    expect(consume).toHaveBeenCalledWith('/auth/login', 'ip:127.0.0.1', 20, 60);
  });

  it('enforces subject limits independently of account existence', async () => {
    consume
      .mockResolvedValueOnce({
        allowed: true,
        hits: 1,
        retryAfterSeconds: 0,
      })
      .mockResolvedValueOnce({
        allowed: false,
        hits: 5,
        retryAfterSeconds: 18,
      });
    await expect(
      guard.canActivate(
        context('/forgot-password', { email: 'ghost@example.com' }, '::1'),
      ),
    ).rejects.toThrow(HttpException);
  });
});
