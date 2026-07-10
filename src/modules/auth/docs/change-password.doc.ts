import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { LogoutResponseDto } from '../dto/auth-response.dto';

export const ChangePasswordDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Change password for the authenticated user (revokes active sessions)',
    }),
    ApiOkResponse({
      description: sysMsg.PASSWORD_CHANGED,
      type: LogoutResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.UNAUTHORIZED,
    }),
  );
