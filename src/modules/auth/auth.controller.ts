import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Header,
  Patch,
  Post,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { IAuthUser, IRequestWithUser } from '../../common/types';
import * as sysMsg from '../../constants/system.messages';
import { UpdatePatientPersonalProfileDto } from '../patient/personal-profile/patient-personal-profile.dto';

import { AuthService } from './auth.service';
import { AuthAbuseGuard } from './challenges/auth-abuse.guard';
import {
  RegisterAccountDto,
  RegistrationBootstrapDto,
  ResendAuthChallengeDto,
  VerifyAuthChallengeDto,
} from './contracts';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ForgotPasswordDocs,
  ChangePasswordDocs,
  GetProfileDocs,
  GoogleLoginDocs,
  LoginDocs,
  ResendLoginDocs,
  LogoutDocs,
  RefreshTokenDocs,
  ResendVerificationDocs,
  ResetPasswordDocs,
  SignupDocs,
  UpdateProfileDocs,
  VerifySignupDocs,
  VerifyLoginDocs,
} from './docs';
import { LogoutResponseDto } from './dto/auth-response.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto,
  GoogleLoginDto,
  VerifySignupDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { RevokeOwnedSessionDto, SessionMetadataDto } from './dto/session.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('registration/bootstrap')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Get current self-service registration and legal-document metadata',
  })
  @ApiOkResponse({ type: RegistrationBootstrapDto })
  getRegistrationBootstrap(): RegistrationBootstrapDto {
    return this.authService.getRegistrationBootstrap();
  }

  @SignupDocs()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  @UseGuards(AuthAbuseGuard)
  signup(@Body() signupDto: RegisterAccountDto, @Req() request?: Request) {
    return this.authService.signup(signupDto, request?.get('idempotency-key'), {
      ipAddress: request?.ip,
      userAgent: request?.get('user-agent'),
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LoginDocs()
  @UseGuards(AuthAbuseGuard)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @VerifyLoginDocs()
  @UseGuards(AuthAbuseGuard)
  verifyLogin(@Body() payload: VerifyAuthChallengeDto) {
    return this.authService.verifyLogin(payload);
  }

  @Public()
  @Post('login/resend')
  @HttpCode(HttpStatus.OK)
  @ResendLoginDocs()
  @UseGuards(AuthAbuseGuard)
  resendLogin(@Body() payload: ResendAuthChallengeDto) {
    return this.authService.resendLogin(payload);
  }

  @Public()
  @Post('google-login')
  @HttpCode(HttpStatus.GONE)
  @GoogleLoginDocs()
  googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto.token);
  }

  @RefreshTokenDocs()
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() refreshToken: RefreshTokenDto) {
    return this.authService.refreshToken(refreshToken);
  }

  @ForgotPasswordDocs()
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthAbuseGuard)
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Public()
  @Post('forgot-password/resend')
  @HttpCode(HttpStatus.OK)
  @ResendVerificationDocs()
  @UseGuards(AuthAbuseGuard)
  resendRecovery(@Body() payload: ResendAuthChallengeDto) {
    return this.authService.resendRecovery(payload);
  }

  @ResetPasswordDocs()
  @Public()
  @Post('reset-password')
  @UseGuards(AuthAbuseGuard)
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @VerifySignupDocs()
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthAbuseGuard)
  verifySignup(@Body() payload: VerifySignupDto) {
    return this.authService.verifySignup(payload);
  }

  @ResendVerificationDocs()
  @Public()
  @Post('verify/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthAbuseGuard)
  resendVerification(@Body() payload: ResendAuthChallengeDto) {
    return this.authService.resendVerification(payload);
  }

  // Keep a guarded rejection for legacy clients: 401 without a valid JWT,
  // 403 with one. Only the proof-of-contact verification flow can activate users.
  @ApiExcludeEndpoint()
  @UseGuards(JwtAuthGuard)
  @Patch('users/:user_id/activate')
  activateAccount(): never {
    throw new ForbiddenException(
      'Legacy account activation is disabled. Verify your contact instead.',
    );
  }

  @GetProfileDocs()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('me')
  async getProfile(@Req() req: IRequestWithUser) {
    return this.authService.getProfile(req);
  }

  @UpdateProfileDocs()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('me')
  async updateProfile(
    @Req() req: IRequestWithUser,
    @Body() updateProfileDto: UpdatePatientPersonalProfileDto,
  ) {
    return this.authService.updateProfile(req, updateProfileDto);
  }

  @ChangePasswordDocs()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Req() req: IRequestWithUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req, changePasswordDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @LogoutDocs()
  async logout(@CurrentUser() user: IAuthUser, @Body() logoutDto: LogoutDto) {
    return this.authService.logout(user.id, logoutDto, user.sessionId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions owned by the caller' })
  @ApiOkResponse({ type: SessionMetadataDto, isArray: true })
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  listSessions(@CurrentUser() user: IAuthUser): Promise<SessionMetadataDto[]> {
    return this.authService.listSessions(user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a session owned by the caller' })
  @ApiOkResponse({ type: LogoutResponseDto })
  @Post('sessions/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() user: IAuthUser,
    @Body() dto: RevokeOwnedSessionDto,
  ) {
    await this.authService.logout(user.id, dto);
    return { message: sysMsg.LOGOUT_SUCCESS };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions owned by the caller' })
  @ApiOkResponse({ type: LogoutResponseDto })
  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  revokeAllSessions(@CurrentUser() user: IAuthUser) {
    return this.authService.revokeAllSessions(user.id);
  }
}
