import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthAbuseGuard } from '../challenges/auth-abuse.guard';
import { AuthChallengeErrorResponseDto } from '../contracts/auth-contract-response.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

import {
  BeginEmailChangeDto,
  ConfirmEmailChangeDto,
  EmailChangeChallengeDto,
  EmailChangeCommittedDto,
  EmailChangeHandleDto,
} from './email-change.dto';
import { EmailChangeService } from './email-change.service';

type SessionUser = { id: string; sessionId: string };

@ApiTags('Authentication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthAbuseGuard)
@Controller('auth/me/email-change')
export class EmailChangeController {
  constructor(private readonly changes: EmailChangeService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Request a verified email change' })
  @ApiOkResponse({ type: EmailChangeChallengeDto })
  @ApiBadRequestResponse({ type: AuthChallengeErrorResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto })
  begin(@CurrentUser() user: SessionUser, @Body() body: BeginEmailChangeDto) {
    return this.changes.begin(user.id, user.sessionId, body);
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Resend candidate email proof' })
  @ApiOkResponse({ type: EmailChangeChallengeDto })
  @ApiBadRequestResponse({ type: AuthChallengeErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto })
  resend(@CurrentUser() user: SessionUser, @Body() body: EmailChangeHandleDto) {
    return this.changes.resend(user.id, user.sessionId, body.challenge_id);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Commit a verified email and revoke every session' })
  @ApiOkResponse({ type: EmailChangeCommittedDto })
  @ApiBadRequestResponse({ type: AuthChallengeErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: AuthChallengeErrorResponseDto })
  confirm(
    @CurrentUser() user: SessionUser,
    @Body() body: ConfirmEmailChangeDto,
  ) {
    return this.changes.confirm(
      user.id,
      user.sessionId,
      body.challenge_id,
      body.code,
    );
  }
}
