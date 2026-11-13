import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Request } from 'express';

import { BrowserSessionConfig } from './browser-session.config';
import {
  BROWSER_CLIENT_HEADER,
  BROWSER_CLIENT_HEADER_VALUE,
} from './browser-session.constants';

@Injectable()
export class BrowserSessionGuard implements CanActivate {
  constructor(private readonly config: BrowserSessionConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.isEnabled()) {
      throw new ServiceUnavailableException(
        'Browser session transport is not enabled.',
      );
    }
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');
    if (
      !origin ||
      origin === 'null' ||
      !this.config.allowedOrigins().includes(origin)
    ) {
      throw new ForbiddenException('Browser origin is not allowed.');
    }
    if (request.get(BROWSER_CLIENT_HEADER) !== BROWSER_CLIENT_HEADER_VALUE) {
      throw new ForbiddenException('Browser client header is required.');
    }

    const hasBody =
      (request.get('content-length') !== undefined &&
        request.get('content-length') !== '0') ||
      request.get('transfer-encoding') !== undefined;
    const contentType = request.get('content-type')?.split(';', 1)[0].trim();
    if (hasBody && contentType?.toLowerCase() !== 'application/json') {
      throw new UnsupportedMediaTypeException(
        'Browser session request bodies must use application/json.',
      );
    }

    if (this.isCredentialOnlyRoute(request)) {
      if (request.get('authorization')) {
        throw new BadRequestException(
          'Browser refresh credentials are accepted only from the approved cookie.',
        );
      }
      if (Object.keys(request.query ?? {}).length > 0) {
        throw new BadRequestException(
          'Browser session lifecycle endpoints do not accept query parameters.',
        );
      }
      if (
        request.body &&
        typeof request.body === 'object' &&
        Object.keys(request.body as Record<string, unknown>).length > 0
      ) {
        throw new BadRequestException(
          'Browser refresh credentials are accepted only from the approved cookie.',
        );
      }
    }
    return true;
  }

  private isCredentialOnlyRoute(request: Request): boolean {
    return /\/browser\/(refresh|logout)\/?$/.test(
      request.route?.path ? request.baseUrl + request.route.path : request.path,
    );
  }
}
