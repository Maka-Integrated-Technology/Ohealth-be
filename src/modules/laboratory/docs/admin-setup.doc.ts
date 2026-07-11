import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import * as sysMsg from '../../../constants/system.messages';
import { LaboratoryAdminSetupResponseDto } from '../dto/laboratory-admin-setup-response.dto';

export const LaboratoryAdminSetupDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Create a laboratory and its primary administrator account (platform admin only)',
    }),
    ApiCreatedResponse({
      description: sysMsg.LABORATORY_ADMIN_SETUP_COMPLETED,
      type: LaboratoryAdminSetupResponseDto,
    }),
    ApiConflictResponse({
      description:
        'Laboratory registration/license number already exists, or administrator email belongs to another account',
    }),
    ApiBadRequestResponse({
      description: sysMsg.VALIDATION_ERROR,
    }),
    ApiUnauthorizedResponse({
      description: sysMsg.UNAUTHORIZED,
    }),
    ApiForbiddenResponse({
      description: sysMsg.PERMISSION_DENIED,
    }),
  );
