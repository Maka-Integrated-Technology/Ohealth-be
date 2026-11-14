import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { AuthAbuseGuard } from '../challenges/auth-abuse.guard';
import { VerifyAuthChallengeDto } from '../contracts';
import { VerifySignupDto } from '../dto/auth.dto';
import { CompleteGoogleOAuthDto } from '../oauth/oauth.dto';

import { BrowserSessionCookieService } from './browser-session-cookie.service';
import { BrowserSessionTransportService } from './browser-session-transport.service';
import {
  BrowserLogoutDocs,
  BrowserOAuthCompletionDocs,
  BrowserRefreshDocs,
  BrowserSessionCompletionDocs,
} from './browser-session.docs';
import { BrowserSessionGuard } from './browser-session.guard';

@ApiTags('Authentication')
@Controller('auth/browser')
@Public()
@UseGuards(BrowserSessionGuard)
export class BrowserSessionController {
  constructor(
    private readonly transport: BrowserSessionTransportService,
    private readonly cookies: BrowserSessionCookieService,
  ) {}

  @Post('verify')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthAbuseGuard)
  @BrowserSessionCompletionDocs(
    'Verify contact ownership and issue a browser session',
  )
  async verifySignup(
    @Body() payload: VerifySignupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.transport.verifySignup(payload);
    this.cookies.write(
      response,
      result.refreshCredential,
      result.sessionExpiresAt,
    );
    return result.response;
  }

  @Post('login/verify')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthAbuseGuard)
  @BrowserSessionCompletionDocs(
    'Verify a login code and issue a browser session',
  )
  async verifyLogin(
    @Body() payload: VerifyAuthChallengeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.transport.verifyLogin(payload);
    this.cookies.write(
      response,
      result.refreshCredential,
      result.sessionExpiresAt,
    );
    return result.response;
  }

  @Post('oauth/google/complete')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthAbuseGuard)
  @BrowserOAuthCompletionDocs()
  async completeGoogle(
    @Body() payload: CompleteGoogleOAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.transport.completeGoogle(payload);
    if (result.issuedSession) {
      this.cookies.write(
        response,
        result.refreshCredential,
        result.sessionExpiresAt,
      );
    } else if (
      result.response.error_code === 'OAUTH_CONTACT_VERIFICATION_REQUIRED'
    ) {
      response.status(HttpStatus.ACCEPTED);
    }
    return result.response;
  }

  @Post('refresh')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @BrowserRefreshDocs()
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const credential = this.cookies.extract(request);
      const result = await this.transport.refresh(credential);
      this.cookies.write(
        response,
        result.refreshCredential,
        result.sessionExpiresAt,
      );
      return result.response;
    } catch (error) {
      this.cookies.clear(response);
      throw error;
    }
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @BrowserLogoutDocs()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const credential = this.cookies.extract(request);
      const result = await this.transport.logout(credential);
      this.cookies.clear(response);
      return result;
    } catch (error) {
      this.cookies.clear(response);
      throw error;
    }
  }
}
