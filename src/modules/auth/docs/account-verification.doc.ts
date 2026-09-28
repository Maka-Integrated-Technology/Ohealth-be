import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../../common/dto/response.dto';

export const ForgotPasswordDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Request a password reset code' }),
    ApiCreatedResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({ description: 'Email validation failed' }),
  );

export const ResetPasswordDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Reset a password with a valid reset code' }),
    ApiCreatedResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({ description: 'Reset code is invalid or expired' }),
  );

export const VerifySignupDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Verify a newly registered email address' }),
    ApiOkResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({
      description: 'Verification code is invalid or expired',
    }),
    ApiNotFoundResponse({ description: 'User account not found' }),
  );

export const ResendVerificationDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Send a new email verification code' }),
    ApiOkResponse({ type: ApiMessageResponseDto }),
    ApiBadRequestResponse({ description: 'Account is already verified' }),
  );
