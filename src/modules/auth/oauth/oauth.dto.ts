import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { AuthChallengeContinuationDto } from '../contracts/auth-contract-response.dto';
import { SignupIntent } from '../enums/signup-intent.enum';

import { OAuthConsumer, OAuthOperation } from './oauth.enums';

export class StartGoogleOAuthDto {
  @ApiProperty({ enum: OAuthOperation })
  @IsEnum(OAuthOperation)
  operation: OAuthOperation;

  @ApiProperty({ enum: OAuthConsumer })
  @IsEnum(OAuthConsumer)
  consumer: OAuthConsumer;

  @ApiProperty({
    description: 'Exact Google OAuth client ID used by this client',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  audience: string;

  @ApiPropertyOptional({ enum: SignupIntent })
  @ValidateIf(
    (dto: StartGoogleOAuthDto) => dto.operation === OAuthOperation.SIGNUP,
  )
  @IsEnum(SignupIntent)
  intent?: SignupIntent;

  @ApiPropertyOptional({ maxLength: 50 })
  @ValidateIf(
    (dto: StartGoogleOAuthDto) => dto.operation === OAuthOperation.SIGNUP,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accepted_terms_version?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @ValidateIf(
    (dto: StartGoogleOAuthDto) => dto.operation === OAuthOperation.SIGNUP,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accepted_privacy_version?: string;
}

export class StartGoogleLinkDto {
  @ApiProperty({ enum: OAuthConsumer })
  @IsEnum(OAuthConsumer)
  consumer: OAuthConsumer;

  @ApiProperty({ description: 'Exact allowlisted Google OAuth client ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  audience: string;
}

export class CompleteGoogleOAuthDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  transaction_id: string;

  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{43}$' })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  transaction_token: string;

  @ApiProperty({ description: 'Google-signed OpenID Connect ID token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16384)
  id_token: string;
}

export class GoogleOAuthTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  transaction_id: string;
  @ApiProperty()
  transaction_token: string;
  @ApiProperty()
  nonce: string;
  @ApiProperty()
  audience: string;
  @ApiProperty()
  expires_in_seconds: number;
}

export class OAuthContactVerificationResponseDto extends AuthChallengeContinuationDto {
  @ApiProperty({
    enum: ['OAUTH_CONTACT_VERIFICATION_REQUIRED'],
    example: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
  })
  error_code: 'OAUTH_CONTACT_VERIFICATION_REQUIRED';
}
