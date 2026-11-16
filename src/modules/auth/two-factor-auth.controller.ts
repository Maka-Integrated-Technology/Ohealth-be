import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../common/dto/response.dto';
import { IAuthUser } from '../../common/types';

import { CurrentUser } from './decorators/current-user.decorator';
import {
  BeginMfaDto,
  ConfirmMfaDto,
  ChangeMfaDto,
  MfaRecoveryCodesResponseDto,
} from './dto/mfa.dto';
import { EnableTwoFactorAuthDataDto } from './dto/two-factor-auth-response.dto';
import { TwoFactorAuthService } from './two-factor-auth.service';

@ApiTags('2FA')
@ApiBearerAuth()
@Controller('auth/2fa')
export class TwoFactorAuthController {
  constructor(private readonly twoFactorAuthService: TwoFactorAuthService) {}

  // The factor is always enrolled for the caller. Taking the user from a path
  // parameter let anyone mint a factor - and read its secret - for any account.
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Begin MFA enrollment for the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a pending secret and QR code for confirmation',
    type: EnableTwoFactorAuthDataDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'A valid access token is required',
  })
  @Header('Cache-Control', 'no-store')
  async enable2fa(@CurrentUser() user: IAuthUser, @Body() body: BeginMfaDto) {
    return this.twoFactorAuthService.enable2fa(
      user.id,
      body.password,
      body.current_code,
    );
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confirm a pending MFA enrollment' })
  @ApiResponse({ status: HttpStatus.OK, type: MfaRecoveryCodesResponseDto })
  confirm(@CurrentUser() user: IAuthUser, @Body() body: ConfirmMfaDto) {
    return this.twoFactorAuthService.confirm2fa(user.id, body.code);
  }

  @Post('recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Regenerate MFA recovery codes after recent authentication',
  })
  @ApiResponse({ status: HttpStatus.OK, type: MfaRecoveryCodesResponseDto })
  regenerate(@CurrentUser() user: IAuthUser, @Body() body: ChangeMfaDto) {
    return this.twoFactorAuthService.regenerateCodes(
      user.id,
      body.password,
      body.code,
    );
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA after recent authentication' })
  @ApiResponse({ status: HttpStatus.OK, type: ApiMessageResponseDto })
  @ApiForbiddenResponse({
    description: 'MFA is required for the current privileged account.',
  })
  disable(@CurrentUser() user: IAuthUser, @Body() body: ChangeMfaDto) {
    return this.twoFactorAuthService.disable2fa(
      user.id,
      body.password,
      body.code,
    );
  }
}
