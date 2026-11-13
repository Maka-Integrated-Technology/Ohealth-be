import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Public } from '../../../common/decorators/public.decorator';
import { ApiMessageResponseDto } from '../../../common/dto/response.dto';
import { IRequestWithUser } from '../../../common/types';
import { AuthAbuseGuard } from '../challenges/auth-abuse.guard';
import { AuthChallengeErrorResponseDto } from '../contracts/auth-contract-response.dto';
import { LoginResponseDto } from '../dto/auth-response.dto';

import {
  CompleteGoogleOAuthDto,
  GoogleOAuthTransactionResponseDto,
  OAuthContactVerificationResponseDto,
  StartGoogleLinkDto,
  StartGoogleOAuthDto,
} from './oauth.dto';
import { OAuthConsumer } from './oauth.enums';
import { OAuthErrorResponseDto } from './oauth.error';
import { OAuthService } from './oauth.service';

import type { Response } from 'express';

@ApiTags('Authentication - Google OAuth')
@Controller('auth/oauth/google')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Public()
  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthAbuseGuard)
  @ApiOperation({
    summary: 'Start a nonce-bound Google signup or sign-in transaction',
  })
  @ApiCreatedResponse({ type: GoogleOAuthTransactionResponseDto })
  @ApiBadRequestResponse({ type: OAuthErrorResponseDto })
  @ApiConflictResponse({ type: OAuthErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: OAuthErrorResponseDto })
  start(@Body() dto: StartGoogleOAuthDto) {
    return this.oauth.start(dto);
  }

  @ApiBearerAuth()
  @Post('link/transactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a recent-auth-bound Google linking transaction',
  })
  @ApiCreatedResponse({ type: GoogleOAuthTransactionResponseDto })
  @ApiUnauthorizedResponse({ type: OAuthErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: OAuthErrorResponseDto })
  startLink(@Req() request: IRequestWithUser, @Body() dto: StartGoogleLinkDto) {
    return this.oauth.startLink(
      request.user.id,
      request.user.sessionId,
      dto.consumer,
      dto.audience,
    );
  }

  @Public()
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthAbuseGuard)
  @ApiOperation({ summary: 'Consume a Google OAuth transaction exactly once' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiAcceptedResponse({ type: OAuthContactVerificationResponseDto })
  @ApiBadRequestResponse({ type: OAuthErrorResponseDto })
  @ApiUnauthorizedResponse({ type: OAuthErrorResponseDto })
  @ApiConflictResponse({ type: OAuthErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: OAuthErrorResponseDto })
  async complete(
    @Body() dto: CompleteGoogleOAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.oauth.complete(dto, OAuthConsumer.MOBILE);
    if ('error_code' in result) {
      response.status(HttpStatus.ACCEPTED);
    }
    return result;
  }

  @ApiBearerAuth()
  @Delete('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink Google after recent authentication' })
  @ApiOkResponse({ type: ApiMessageResponseDto })
  @ApiUnauthorizedResponse({ type: OAuthErrorResponseDto })
  @ApiConflictResponse({ type: OAuthErrorResponseDto })
  unlink(@Req() request: IRequestWithUser) {
    return this.oauth.unlink(request.user.id, request.user.sessionId);
  }
}
