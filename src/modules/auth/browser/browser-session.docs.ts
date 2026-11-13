import { applyDecorators } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../../common/dto/response.dto';
import { AuthChallengeErrorResponseDto } from '../contracts';
import { LogoutResponseDto } from '../dto/auth-response.dto';
import { OAuthContactVerificationResponseDto } from '../oauth/oauth.dto';
import { OAuthErrorResponseDto } from '../oauth/oauth.error';

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

export const BrowserOAuthCompletionDocs = () =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiExtraModels(BrowserSessionResponseDto, ApiMessageResponseDto),
    ApiOperation({
      summary: 'Complete a web Google OAuth transaction',
      description:
        'Completes only transactions bound to the web consumer. Session credentials are written to the browser cookie and never returned in JSON.',
    }),
    ApiOkResponse({
      schema: {
        oneOf: [
          { $ref: getSchemaPath(BrowserSessionResponseDto) },
          { $ref: getSchemaPath(ApiMessageResponseDto) },
        ],
      },
    }),
    ApiAcceptedResponse({ type: OAuthContactVerificationResponseDto }),
    ApiBadRequestResponse({ type: OAuthErrorResponseDto }),
    ApiUnauthorizedResponse({ type: OAuthErrorResponseDto }),
    ApiConflictResponse({ type: OAuthErrorResponseDto }),
    ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto }),
    ApiServiceUnavailableResponse({ type: OAuthErrorResponseDto }),
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
