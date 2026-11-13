import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthChallengeErrorResponseDto } from '../contracts';
import { LogoutResponseDto } from '../dto/auth-response.dto';

import { BrowserSessionResponseDto } from './browser-session.dto';

const BrowserBoundaryDocs = () =>
  applyDecorators(
    ApiHeader({
      name: 'X-OHealth-Client',
      required: true,
      schema: { type: 'string', enum: ['browser'] },
    }),
    ApiForbiddenResponse({ description: 'Origin or browser header rejected' }),
  );

export const BrowserSessionCompletionDocs = (summary: string) =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiOperation({ summary }),
    ApiOkResponse({ type: BrowserSessionResponseDto }),
    ApiBadRequestResponse({
      description: 'Challenge or request is invalid',
      type: AuthChallengeErrorResponseDto,
    }),
  );

export const BrowserRefreshDocs = () =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiCookieAuth('browserRefresh'),
    ApiOperation({ summary: 'Rotate the browser refresh cookie' }),
    ApiOkResponse({ type: BrowserSessionResponseDto }),
    ApiUnauthorizedResponse({
      description: 'Refresh cookie is invalid, expired, replayed, or revoked',
    }),
  );

export const BrowserLogoutDocs = () =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiCookieAuth('browserRefresh'),
    ApiOperation({ summary: 'Revoke and clear the browser session' }),
    ApiOkResponse({
      description: 'Browser session revoked',
      type: LogoutResponseDto,
    }),
    ApiUnauthorizedResponse({ description: 'Refresh cookie is invalid' }),
  );
