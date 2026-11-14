import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { AuthCapability } from '../../auth/context/auth-capability';
import { AUTH_CAPABILITIES_KEY } from '../../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LaboratoryApprovedGuard } from '../guards/laboratory-approved.guard';

import { LaboratoryOperationalAccess } from './laboratory-operational-access.decorator';

describe('LaboratoryOperationalAccess', () => {
  const reflector = new Reflector();

  @LaboratoryOperationalAccess()
  class ProtectedLaboratoryController {}

  it('should enforce authentication, organization capability and laboratory approval', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProtectedLaboratoryController),
    ).toEqual([JwtAuthGuard, CapabilitiesGuard, LaboratoryApprovedGuard]);
    expect(
      reflector.get<AuthCapability[]>(
        AUTH_CAPABILITIES_KEY,
        ProtectedLaboratoryController,
      ),
    ).toEqual([AuthCapability.ORGANIZATION_OPERATIONAL]);
  });
});
