import { applyDecorators } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { ActivateAccountResponseDto } from '../dto/activate-account-response.dto';

export const ActivateAccountDocs = () =>
  applyDecorators(
    ApiOperation({ summary: sysMsg.ACTIVATE_ACCOUNT }),
    ApiOkResponse({
      description: sysMsg.USER_ACTIVATED,
      type: ActivateAccountResponseDto,
    }),
    ApiNotFoundResponse({
      description: sysMsg.USER_NOT_FOUND,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.TOKEN_INVALID,
    }),
    ApiForbiddenResponse({
      description: sysMsg.PERMISSION_DENIED,
    }),
  );
