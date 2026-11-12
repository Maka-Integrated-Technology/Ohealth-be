import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { AuthChallengeErrorResponseDto } from '../contracts';
import {
  LoginChallengeResponseDto,
  LoginResponseDto,
} from '../dto/auth-response.dto';

export const LoginDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Validate password and queue a login verification code',
    }),
    ApiOkResponse({
      description: 'Password accepted and login verification queued',
      type: LoginChallengeResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.INVALID_CREDENTIALS,
    }),
    ApiBadRequestResponse({
      description: sysMsg.VALIDATION_ERROR,
    }),
    ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto }),
    ApiServiceUnavailableResponse({ type: AuthChallengeErrorResponseDto }),
  );

export const VerifyLoginDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Verify a login code and issue a session' }),
    ApiOkResponse({
      description: sysMsg.LOGIN_SUCCESS,
      type: LoginResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Invalid or expired authentication challenge',
      type: AuthChallengeErrorResponseDto,
    }),
  );

export const ResendLoginDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Resend a pending login verification code' }),
    ApiOkResponse({
      description: 'Generic queued response',
      type: LoginChallengeResponseDto,
    }),
    ApiBadRequestResponse({
      description: sysMsg.VALIDATION_ERROR,
      type: AuthChallengeErrorResponseDto,
    }),
    ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto }),
    ApiServiceUnavailableResponse({ type: AuthChallengeErrorResponseDto }),
  );
