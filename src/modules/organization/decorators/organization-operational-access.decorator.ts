import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ORGANIZATION_ADMIN_ROLES } from '../constants/organization-role.constant';
import { OrganizationApprovedGuard } from '../guards/organization-approved.guard';

export const OrganizationOperationalAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    Roles(...ORGANIZATION_ADMIN_ROLES),
    UseGuards(JwtAuthGuard, RolesGuard, OrganizationApprovedGuard),
    ApiForbiddenResponse({
      description:
        'Organization administrator access requires an active, approved organization',
    }),
  );
