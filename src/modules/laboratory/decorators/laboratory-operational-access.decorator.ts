import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';

import { AuthCapability } from '../../auth/context/auth-capability';
import { RequireCapabilities } from '../../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LaboratoryApprovedGuard } from '../guards/laboratory-approved.guard';

export const LaboratoryOperationalAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    RequireCapabilities(AuthCapability.ORGANIZATION_OPERATIONAL),
    UseGuards(JwtAuthGuard, CapabilitiesGuard, LaboratoryApprovedGuard),
    ApiForbiddenResponse({
      description:
        'Laboratory administrator access requires an approved laboratory',
    }),
  );
