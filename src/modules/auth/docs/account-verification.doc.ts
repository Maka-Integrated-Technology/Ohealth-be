import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../../common/dto/response.dto';
import {
  AuthChallengeContinuationDto,
  AuthChallengeErrorResponseDto,
} from '../contracts';
import { VerifySignupResponseDto } from '../dto/auth-response.dto';

export const ForgotPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Queue a purpose-bound password-recovery challenge (generic response)',
    }),
    ApiAcceptedResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({ description: 'Email validation failed' }),
    ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto }),
    ApiServiceUnavailableResponse({ type: AuthChallengeErrorResponseDto }),
  );

export const ResetPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Complete password recovery with challenge ID and code',
    }),
    ApiCreatedResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({
      description: 'Reset code is invalid or expired',
      type: AuthChallengeErrorResponseDto,
    }),
  );

export const VerifySignupDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify email ownership and create first authenticated session',
    }),
    ApiOkResponse({ type: VerifySignupResponseDto }),
    ApiBadRequestResponse({
      description: 'Verification code is invalid or expired',
      type: AuthChallengeErrorResponseDto,
    }),
  );

export const ResendVerificationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Replace a purpose-bound challenge using its opaque handle',
    }),
    ApiOkResponse({ type: AuthChallengeContinuationDto }),
    ApiBadRequestResponse({ type: AuthChallengeErrorResponseDto }),
    ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto }),
    ApiServiceUnavailableResponse({ type: AuthChallengeErrorResponseDto }),
  );
