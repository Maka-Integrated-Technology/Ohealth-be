import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../../../common/dto/response.dto';

export const OAuthErrorCodes = {
  transactionInvalid: 'OAUTH_TRANSACTION_INVALID',
  transactionExpired: 'OAUTH_TRANSACTION_EXPIRED',
  transactionReplayed: 'OAUTH_TRANSACTION_REPLAYED',
  tokenInvalid: 'OAUTH_TOKEN_INVALID',
  signupRequired: 'OAUTH_SIGNUP_REQUIRED',
  accountLinkRequired: 'OAUTH_ACCOUNT_LINK_REQUIRED',
  identityConflict: 'OAUTH_IDENTITY_CONFLICT',
  intentNotSupported: 'OAUTH_INTENT_NOT_SUPPORTED',
  legalVersionStale: 'OAUTH_LEGAL_VERSION_STALE',
  contactVerificationRequired: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
  authenticationFailed: 'OAUTH_AUTHENTICATION_FAILED',
  lastAuthenticator: 'OAUTH_LAST_AUTHENTICATOR',
  recentAuthRequired: 'OAUTH_RECENT_AUTH_REQUIRED',
  transactionRequired: 'OAUTH_TRANSACTION_REQUIRED',
} as const;

export type OAuthErrorCode =
  (typeof OAuthErrorCodes)[keyof typeof OAuthErrorCodes];

const STATUS = new Map<OAuthErrorCode, HttpStatus>([
  ['OAUTH_ACCOUNT_LINK_REQUIRED', HttpStatus.CONFLICT],
  ['OAUTH_IDENTITY_CONFLICT', HttpStatus.CONFLICT],
  ['OAUTH_SIGNUP_REQUIRED', HttpStatus.CONFLICT],
  ['OAUTH_INTENT_NOT_SUPPORTED', HttpStatus.UNPROCESSABLE_ENTITY],
  ['OAUTH_LEGAL_VERSION_STALE', HttpStatus.CONFLICT],
  ['OAUTH_CONTACT_VERIFICATION_REQUIRED', HttpStatus.ACCEPTED],
  ['OAUTH_LAST_AUTHENTICATOR', HttpStatus.CONFLICT],
  ['OAUTH_RECENT_AUTH_REQUIRED', HttpStatus.UNAUTHORIZED],
  ['OAUTH_TRANSACTION_REPLAYED', HttpStatus.CONFLICT],
  ['OAUTH_TRANSACTION_REQUIRED', HttpStatus.GONE],
]);

export class OAuthErrorResponseDto extends ApiErrorResponseDto {
  @ApiProperty({
    enum: Object.values(OAuthErrorCodes),
    enumName: 'OAuthErrorCode',
  })
  declare error_code: OAuthErrorCode;
}

export class OAuthException extends HttpException {
  constructor(
    public readonly errorCode: OAuthErrorCode,
    status = STATUS.get(errorCode) ?? HttpStatus.UNAUTHORIZED,
  ) {
    super(
      {
        statusCode: status,
        error: 'OAuth request could not be completed.',
        error_code: errorCode,
      },
      status,
    );
  }
}
