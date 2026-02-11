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
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { IRequestWithUser } from '../../common/types';

import { AuthService } from './auth.service';
import {
  ActivateAccountDocs,
  GetProfileDocs,
  GoogleLoginDocs,
  LoginDocs,
  LogoutDocs,
  RefreshTokenDocs,
  SignupDocs,
} from './docs';
import {
  AuthDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto,
  GoogleLoginDto,
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
    return this.authService.googleLogin(
      googleLoginDto.token,
      googleLoginDto.invite_token,
    );
  }

  @RefreshTokenDocs()
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() refreshToken: RefreshTokenDto) {
    return this.authService.refreshToken(refreshToken);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifySignup(@Body() payload: VerifySignupDto) {
    return this.authService.verifySignup(payload);
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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @LogoutDocs()
  async logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto);
  }
}
