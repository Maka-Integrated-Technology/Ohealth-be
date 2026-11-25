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
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../../common/dto/response.dto';
import { AuthChallengeErrorResponseDto } from '../contracts';
import { LogoutResponseDto } from '../dto/auth-response.dto';
import { MfaChallengeResponseDto } from '../dto/mfa.dto';
import { OAuthContactVerificationResponseDto } from '../oauth/oauth.dto';
import { OAuthErrorResponseDto } from '../oauth/oauth.error';

import { BrowserSessionResponseDto } from './browser-session.dto';

const BrowserBoundaryDocs = () =>
  applyDecorators(
    ApiHeader({
      name: 'Origin',
      required: false,
      description:
        'Required on the HTTP request and set automatically by browsers. It must be an exact configured allowed web origin; null and wildcard origins are rejected. Browser JavaScript cannot set this header manually.',
    }),
    ApiHeader({
      name: 'X-OHealth-Client',
      required: true,
      schema: { type: 'string', enum: ['browser'] },
    }),
    ApiForbiddenResponse({ description: 'Origin or browser header rejected' }),
    ApiBadRequestResponse({
      description: 'Malformed or forbidden browser credential transport',
    }),
    ApiResponse({
      status: 415,
      description: 'A browser request with a body must use application/json',
    }),
    ApiServiceUnavailableResponse({
      description: 'Browser session transport is disabled',
    }),
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

export const BrowserLoginCompletionDocs = () =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiExtraModels(BrowserSessionResponseDto, MfaChallengeResponseDto),
    ApiOperation({
      summary: 'Verify a login code and continue with MFA when required',
    }),
    ApiOkResponse({
      schema: {
        oneOf: [
          { $ref: getSchemaPath(BrowserSessionResponseDto) },
          { $ref: getSchemaPath(MfaChallengeResponseDto) },
        ],
      },
    }),
    ApiBadRequestResponse({ type: AuthChallengeErrorResponseDto }),
  );

export const BrowserRefreshDocs = () =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiCookieAuth('browserRefresh'),
    ApiOperation({
      summary: 'Rotate the browser refresh cookie',
      description:
        'Send the backend-managed HttpOnly refresh cookie with credentials. Do not send a bearer token, query parameter, or JSON refresh credential. The response contains an access token but no refresh token; rotation is returned in Set-Cookie.',
    }),
    ApiOkResponse({ type: BrowserSessionResponseDto }),
    ApiUnauthorizedResponse({
      description: 'Refresh cookie is invalid, expired, replayed, or revoked',
    }),
  );

export const BrowserOAuthCompletionDocs = () =>
  applyDecorators(
    BrowserBoundaryDocs(),
    ApiExtraModels(
      BrowserSessionResponseDto,
      ApiMessageResponseDto,
      MfaChallengeResponseDto,
    ),
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
          { $ref: getSchemaPath(MfaChallengeResponseDto) },
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
    ApiOperation({
      summary: 'Revoke and clear the browser session',
      description:
        'Send the backend-managed HttpOnly refresh cookie with credentials and no body or an empty JSON object. The response clears the cookie. Bearer, query, and body refresh credentials are rejected.',
    }),
    ApiOkResponse({
      description: 'Browser session revoked',
      type: LogoutResponseDto,
    }),
    ApiUnauthorizedResponse({ description: 'Refresh cookie is invalid' }),
  );
