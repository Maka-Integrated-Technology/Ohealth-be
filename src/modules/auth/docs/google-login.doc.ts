import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiGoneResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { OAuthErrorResponseDto } from '../oauth/oauth.error';

export const GoogleLoginDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Retired Google login; use nonce-bound OAuth transactions',
    }),
    ApiGoneResponse({
      type: OAuthErrorResponseDto,
      description: 'OAUTH_TRANSACTION_REQUIRED',
    }),
    ApiUnauthorizedResponse({
      type: OAuthErrorResponseDto,
    }),
    ApiBadRequestResponse({
      type: OAuthErrorResponseDto,
    }),
  );
