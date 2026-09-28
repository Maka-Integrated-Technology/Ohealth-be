import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { IAuthUser, IRequestWithUser } from '../../common/types';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ActivateAccountDocs,
  ForgotPasswordDocs,
  ChangePasswordDocs,
  GetProfileDocs,
  GoogleLoginDocs,
  LoginDocs,
  LogoutDocs,
  RefreshTokenDocs,
  ResendVerificationDocs,
  ResetPasswordDocs,
  SignupDocs,
  UpdateProfileDocs,
  VerifySignupDocs,
} from './docs';
import {
  AuthDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ResetPasswordDto,
  GoogleLoginDto,
  UpdateProfileDto,
  VerifySignupDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @SignupDocs()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  signup(@Body() signupDto: AuthDto) {
    return this.authService.signup(signupDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LoginDocs()
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('google-login')
  @HttpCode(HttpStatus.OK)
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
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @ResetPasswordDocs()
  @Public()
  @Post('reset-password')
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @VerifySignupDocs()
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifySignup(@Body() payload: VerifySignupDto) {
    return this.authService.verifySignup(payload);
  }

  @ResendVerificationDocs()
  @Public()
  @Post('verify/resend')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() payload: ResendVerificationDto) {
    return this.authService.resendVerification(payload);
  }

  @Public()
  @Patch('users/:user_id/activate')
  @HttpCode(HttpStatus.OK)
  @ActivateAccountDocs()
  async activateAccount(@Param('user_id') userId: string) {
    const message = await this.authService.activateUserAccount(userId);
    return {
      status: HttpStatus.OK,
      message,
    };
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
    @Body() updateProfileDto: UpdateProfileDto,
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
    return this.authService.logout(user.id, logoutDto);
  }
}
