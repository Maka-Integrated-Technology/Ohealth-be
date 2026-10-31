import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../../common/dto/response.dto';
import { VerifySignupResponseDto } from '../dto/auth-response.dto';

export const ForgotPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Queue a purpose-bound password-recovery challenge (generic response)',
    }),
    ApiCreatedResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({ description: 'Email validation failed' }),
  );

export const ResetPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Complete password recovery with challenge ID and code',
    }),
    ApiCreatedResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({ description: 'Reset code is invalid or expired' }),
  );

export const VerifySignupDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify email ownership and create first authenticated session',
    }),
    ApiOkResponse({ type: VerifySignupResponseDto }),
    ApiBadRequestResponse({
      description: 'Verification code is invalid or expired',
    }),
  );

export const ResendVerificationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Queue a new verification challenge for an eligible account',
    }),
    ApiOkResponse({ type: ApiMessageResponseDto }),
  );
