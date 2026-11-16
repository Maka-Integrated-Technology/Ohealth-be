import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';

import { AuthCapability } from '../../auth/context/auth-capability';
import { RequireCapabilities } from '../../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganizationApprovedGuard } from '../../organization/guards/organization-approved.guard';

export const LaboratoryPostApprovalAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    RequireCapabilities(AuthCapability.ORGANIZATION_OPERATIONAL),
    UseGuards(JwtAuthGuard, CapabilitiesGuard, OrganizationApprovedGuard),
    ApiForbiddenResponse({
      description:
        'An active, approved laboratory administrator account is required',
    }),
  );
