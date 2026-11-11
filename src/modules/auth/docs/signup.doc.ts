import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import {
  AuthChallengeErrorResponseDto,
  RegistrationPendingResponseDto,
} from '../contracts';

export const SignupDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a pending intent-based account' }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'UUID v4 used to safely replay an identical registration',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiCreatedResponse({
      description: sysMsg.ACCOUNT_CREATED,
      type: RegistrationPendingResponseDto,
    }),
    ApiConflictResponse({
      description: sysMsg.ACCOUNT_ALREADY_EXISTS,
    }),
    ApiBadRequestResponse({
      description: sysMsg.VALIDATION_ERROR,
    }),
    ApiServiceUnavailableResponse({ type: AuthChallengeErrorResponseDto }),
  );
