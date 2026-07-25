import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../user/enums/user-role.enum';
import { LaboratoryApprovedGuard } from '../guards/laboratory-approved.guard';

export const LaboratoryOperationalAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    Roles(UserRole.LAB_ADMIN),
    UseGuards(JwtAuthGuard, RolesGuard, LaboratoryApprovedGuard),
    ApiForbiddenResponse({
      description:
        'Laboratory administrator access requires an approved laboratory',
    }),
  );
