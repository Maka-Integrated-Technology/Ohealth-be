import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { ChangePasswordResponseDto } from '../dto/auth-response.dto';

export const ChangePasswordDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Change password for the authenticated user (revokes active sessions)',
    }),
    ApiOkResponse({
      description: sysMsg.PASSWORD_CHANGED,
      type: ChangePasswordResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.UNAUTHORIZED,
    }),
    ApiConflictResponse({
      description: 'The new password must differ from the current password.',
    }),
  );
