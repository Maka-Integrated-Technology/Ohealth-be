import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  it('uses a trusted proxy chain without trusting spoofed leftmost addresses', async () => {
    const trustedGuard = new AuthAbuseGuard(
      { consume } as unknown as AuthRateLimitService,
      {
        get: () => '10.0.0.0/8',
      } as unknown as ConfigService,
    );
    const request = (ip: string, forwarded: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            route: { path: '/login' },
            body: {},
            socket: { remoteAddress: ip },
            headers: { 'x-forwarded-for': forwarded },
          }),
        }),
      }) as unknown as ExecutionContext;
    await trustedGuard.canActivate(
      request('10.0.0.5', '198.51.100.40, 203.0.113.22, 10.0.0.4'),
    );
    expect(consume).toHaveBeenCalledWith(
      '/auth/login',
      'ip:203.0.113.22',
      20,
      60,
    );
    consume.mockClear();
    await trustedGuard.canActivate(request('203.0.113.12', '1.2.3.4'));
    expect(consume).toHaveBeenCalledWith(
      '/auth/login',
      'ip:203.0.113.12',
      20,
      60,
    );
  });

  it('handles trusted IPv6 proxies and rejects invalid CIDR policy', async () => {
    const ipv6 = new AuthAbuseGuard(
      { consume } as unknown as AuthRateLimitService,
      { get: () => '2001:db8:1::/48' } as unknown as ConfigService,
    );
    await ipv6.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({
          route: { path: '/login' },
          body: {},
          socket: { remoteAddress: '2001:db8:1::100' },
          headers: { 'x-forwarded-for': '2001:db8:2::1' },
        }),
      }),
    } as unknown as ExecutionContext);
    expect(consume).toHaveBeenCalledWith(
      '/auth/login',
      'ip:2001:db8:2::1',
      20,
      60,
    );
    expect(
      () =>
        new AuthAbuseGuard(
          { consume } as unknown as AuthRateLimitService,
          { get: () => '0.0.0.0/999' } as unknown as ConfigService,
        ),
    ).toThrow('AUTH_TRUSTED_PROXY_CIDRS');
  });
});
