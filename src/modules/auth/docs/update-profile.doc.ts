import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { AuthContextResponseDto } from '../dto/auth-response.dto';

export const UpdateProfileDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update authenticated user profile' }),
    ApiOkResponse({
      description: sysMsg.PROFILE_UPDATED,
      type: AuthContextResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.UNAUTHORIZED,
    }),
  );
