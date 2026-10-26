import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import { AuthRateLimitService } from './auth-rate-limit.service';

interface IAuthAbuseRequest {
  route?: { path?: string };
  path?: string;
  socket?: { remoteAddress?: string };
  body?: { email?: unknown; challenge_id?: unknown; token?: unknown };
}

const POLICY = new Map<string, { ip: number; subject: number }>([
  ['/auth/login', { ip: 20, subject: 8 }],
  ['/auth/verify', { ip: 20, subject: 8 }],
  ['/auth/verify/resend', { ip: 8, subject: 4 }],
  ['/auth/forgot-password', { ip: 8, subject: 4 }],
  ['/auth/reset-password', { ip: 8, subject: 5 }],
]);

/** Do not trust spoofable forwarding headers until trusted proxy setup is audited. */
@Injectable()
export class AuthAbuseGuard implements CanActivate {
  constructor(private readonly rates: AuthRateLimitService) {}

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
    const ip = request.socket?.remoteAddress ?? 'unidentified-peer';
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
