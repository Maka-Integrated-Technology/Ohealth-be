import {
  ArgumentMetadata,
  BadRequestException,
  HttpStatus,
  Type,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';

import {
  ResendAuthChallengeDto,
  VerifyAuthChallengeDto,
} from '../contracts/auth-challenge.dto';
import { ResetPasswordDto, VerifySignupDto } from '../dto/auth.dto';
import {
  BeginEmailChangeDto,
  ConfirmEmailChangeDto,
  EmailChangeHandleDto,
} from '../email-change/email-change.dto';

import {
  AuthChallengeErrorCode,
  AuthChallengeException,
} from './auth-challenge.error';

const CHALLENGE_REQUEST_TYPES = new Set<Type<unknown>>([
  ResendAuthChallengeDto,
  ResetPasswordDto,
  VerifyAuthChallengeDto,
  VerifySignupDto,
  BeginEmailChangeDto,
  ConfirmEmailChangeDto,
  EmailChangeHandleDto,
]);

/**
 * Keeps class-validator failures for public challenge routes inside the stable,
 * non-enumerating challenge error contract while preserving normal validation
 * behavior for every other request DTO.
 */
export class AuthChallengeValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super(options);
  }

  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    try {
      return await super.transform(value, metadata);
    } catch (error) {
      if (
        metadata.metatype &&
        CHALLENGE_REQUEST_TYPES.has(metadata.metatype) &&
        error instanceof BadRequestException
      ) {
        throw new AuthChallengeException(
          AuthChallengeErrorCode.INVALID,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw error;
    }
  }
}
