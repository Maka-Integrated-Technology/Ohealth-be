import { BlockList, isIP } from 'node:net';

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthRateLimitService } from './auth-rate-limit.service';

interface IAuthAbuseRequest {
  route?: { path?: string };
  path?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
  body?: { email?: unknown; challenge_id?: unknown; token?: unknown };
}

const POLICY = new Map<string, { ip: number; subject: number }>([
  ['/auth/signup', { ip: 8, subject: 4 }],
  ['/auth/login', { ip: 20, subject: 8 }],
  ['/auth/verify', { ip: 20, subject: 8 }],
  ['/auth/verify/resend', { ip: 8, subject: 4 }],
  ['/auth/forgot-password', { ip: 8, subject: 4 }],
  ['/auth/reset-password', { ip: 8, subject: 5 }],
]);

/** Only trust forwarding addresses from explicitly allowlisted proxy hops. */
@Injectable()
export class AuthAbuseGuard implements CanActivate {
  private readonly trusted = new BlockList();

  constructor(
    private readonly rates: AuthRateLimitService,
    @Optional() private readonly config?: ConfigService,
  ) {
    const cidrs = this.config?.get<string>('AUTH_TRUSTED_PROXY_CIDRS') ?? '';
    for (const cidr of cidrs.split(',').map((value) => value.trim())) {
      if (!cidr) continue;
      const [address, prefixText] = cidr.split('/');
      const family = isIP(address);
      const maximum = family === 4 ? 32 : 128;
      const prefix = prefixText === undefined ? maximum : Number(prefixText);
      if (
        !family ||
        !Number.isInteger(prefix) ||
        prefix < 0 ||
        prefix > maximum ||
        cidr.split('/').length > 2
      ) {
        throw new Error('Invalid AUTH_TRUSTED_PROXY_CIDRS entry.');
      }
      this.trusted.addSubnet(address, prefix, family === 4 ? 'ipv4' : 'ipv6');
    }
  }

  private clientAddress(request: IAuthAbuseRequest): string {
    const peer = request.socket?.remoteAddress ?? '';
    if (!isIP(peer)) {
      throw new Error('Could not identify a valid socket peer IP.');
    }
    if (!this.isTrusted(peer)) return peer;

    const forwarded = request.headers?.['x-forwarded-for'];
    if (typeof forwarded !== 'string' || forwarded.length > 1024) {
      return peer;
    }
    const hops = forwarded.split(',').map((entry) => entry.trim());
    if (hops.length > 16 || hops.some((entry) => !isIP(entry))) {
      return peer;
    }
    // Traverse from the socket peer backwards. A client-provided spoofed
    // leftmost header must never override the first untrusted intermediary.
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!this.isTrusted(hops[i])) return hops[i];
    }
    return hops[0] || peer;
  }

  private isTrusted(ip: string): boolean {
    const family = isIP(ip);
    return !!family && this.trusted.check(ip, family === 4 ? 'ipv4' : 'ipv6');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IAuthAbuseRequest>();
    const rawPath = request.route?.path ?? request.path ?? '';
    // Nest/Express can expose either a controller-local route or a full
    // mounted path with global prefix (/api/auth/...).
    const index = rawPath.indexOf('/auth/');
    const path = index >= 0 ? rawPath.slice(index) : '/auth' + rawPath;
    const limits = path ? POLICY.get(path) : undefined;
    if (!limits) {
      throw new Error('AuthAbuseGuard applied without an abuse policy.');
    }
    const ip = this.clientAddress(request);
    await this.assertBudget(path, 'ip:' + ip, limits.ip);
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : '';
    const challenge =
      typeof request.body?.challenge_id === 'string'
        ? request.body.challenge_id
        : '';
    const token =
      typeof request.body?.token === 'string'
        ? request.body.token.slice(0, 36)
        : '';
    const subject = email || challenge || token;
    if (subject) {
      await this.assertBudget(path, 'subject:' + subject, limits.subject);
    }
    return true;
  }

  private async assertBudget(
    scope: string,
    key: string,
    limit: number,
  ): Promise<void> {
    const result = await this.rates.consume(scope, key, limit, 60);
    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Too many requests. Try again later.',
          retryAfter: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
