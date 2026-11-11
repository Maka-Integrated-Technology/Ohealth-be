import { HttpException, HttpStatus } from '@nestjs/common';

export enum AuthChallengeErrorCode {
  INVALID = 'AUTH_CHALLENGE_INVALID',
  CODE_INVALID = 'AUTH_CHALLENGE_CODE_INVALID',
  EXPIRED = 'AUTH_CHALLENGE_EXPIRED',
  CONSUMED = 'AUTH_CHALLENGE_CONSUMED',
  SUPERSEDED = 'AUTH_CHALLENGE_SUPERSEDED',
  ATTEMPTS_EXHAUSTED = 'AUTH_CHALLENGE_ATTEMPTS_EXHAUSTED',
  COOLDOWN = 'AUTH_CHALLENGE_COOLDOWN',
  DELIVERY_UNAVAILABLE = 'AUTH_CHALLENGE_DELIVERY_UNAVAILABLE',
  SERVICE_TEMPORARILY_UNAVAILABLE = 'AUTH_SERVICE_TEMPORARILY_UNAVAILABLE',
  RATE_LIMITED = 'AUTH_RATE_LIMITED',
}

const MESSAGES: Record<AuthChallengeErrorCode, string> = {
  [AuthChallengeErrorCode.INVALID]: 'Invalid authentication challenge.',
  [AuthChallengeErrorCode.CODE_INVALID]: 'Invalid verification code.',
  [AuthChallengeErrorCode.EXPIRED]: 'Authentication challenge has expired.',
  [AuthChallengeErrorCode.CONSUMED]:
    'Authentication challenge was already used.',
  [AuthChallengeErrorCode.SUPERSEDED]: 'Authentication challenge was replaced.',
  [AuthChallengeErrorCode.ATTEMPTS_EXHAUSTED]:
    'Authentication challenge attempts are exhausted.',
  [AuthChallengeErrorCode.COOLDOWN]:
    'Please wait before requesting another code.',
  [AuthChallengeErrorCode.DELIVERY_UNAVAILABLE]:
    'Verification delivery is temporarily unavailable.',
  [AuthChallengeErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE]:
    'Authentication service is temporarily unavailable.',
  [AuthChallengeErrorCode.RATE_LIMITED]: 'Too many requests. Try again later.',
};

export class AuthChallengeException extends HttpException {
  constructor(
    code: AuthChallengeErrorCode,
    status: HttpStatus,
    retryAfterSeconds?: number,
  ) {
    super(
      {
        message: MESSAGES[code],
        error:
          status === HttpStatus.TOO_MANY_REQUESTS
            ? 'Too Many Requests'
            : status === HttpStatus.SERVICE_UNAVAILABLE
              ? 'Service Unavailable'
              : 'Bad Request',
        error_code: code,
        ...(retryAfterSeconds === undefined
          ? {}
          : { retry_after_seconds: Math.max(1, Math.ceil(retryAfterSeconds)) }),
      },
      status,
    );
  }
}
