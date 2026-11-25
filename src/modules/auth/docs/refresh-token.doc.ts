import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { RefreshTokenResponseDto } from '../dto/auth-response.dto';

export const RefreshTokenDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Refresh a mobile session using a JSON refresh credential',
      description:
        'Mobile clients send refresh_token in the request JSON and receive the rotated refresh_token in response JSON. Browser clients use /api/auth/browser/refresh and keep the refresh credential in an HttpOnly cookie.',
    }),
    ApiOkResponse({
      description: sysMsg.TOKEN_REFRESH_SUCCESS,
      type: RefreshTokenResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.TOKEN_INVALID,
    }),
    ApiBadRequestResponse({
      description: sysMsg.VALIDATION_ERROR,
    }),
  );
