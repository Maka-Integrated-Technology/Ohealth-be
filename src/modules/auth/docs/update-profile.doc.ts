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
    ApiOperation({
      summary: 'Update the authenticated patient personal profile',
      description:
        'Updates ordinary name, demographic, country, and address fields. Email, phone, password, avatar, medical data, roles, personas, and account state require separate workflows.',
    }),
    ApiOkResponse({
      description: sysMsg.PROFILE_UPDATED,
      type: AuthContextResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.UNAUTHORIZED,
    }),
  );
