import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { IAuthUser } from '../../common/types';

import { CurrentUser } from './decorators/current-user.decorator';
import { EnableTwoFactorAuthDataDto } from './dto/two-factor-auth-response.dto';
import {
  IEnable2faResponse,
  TwoFactorAuthService,
} from './two-factor-auth.service';

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
    summary: 'Enable two-factor authentication for the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns secret, QR code, and backup codes',
    type: EnableTwoFactorAuthDataDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'A valid access token is required',
  })
  async enable2fa(@CurrentUser() user: IAuthUser): Promise<IEnable2faResponse> {
    return this.twoFactorAuthService.enable2fa(user.id);
  }
}
