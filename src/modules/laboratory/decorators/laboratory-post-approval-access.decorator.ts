import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrganizationApprovedGuard } from '../../organization/guards/organization-approved.guard';
import { UserRole } from '../../user/enums/user-role.enum';

export const LaboratoryPostApprovalAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    Roles(UserRole.LAB_ADMIN),
    UseGuards(JwtAuthGuard, RolesGuard, OrganizationApprovedGuard),
    ApiForbiddenResponse({
      description:
        'An active, approved laboratory administrator account is required',
    }),
  );
