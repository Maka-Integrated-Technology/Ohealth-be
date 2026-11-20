import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { AuthMeResponseDto } from '../dto/auth-response.dto';

export const GetProfileDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Restore authenticated account context and basic profile data',
    }),
    ApiOkResponse({
      description: sysMsg.PROFILE_RETRIEVED,
      type: AuthMeResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.UNAUTHORIZED,
    }),
  );
