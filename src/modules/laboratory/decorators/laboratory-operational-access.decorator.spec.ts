import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../user/enums/user-role.enum';
import { LaboratoryApprovedGuard } from '../guards/laboratory-approved.guard';

import { LaboratoryOperationalAccess } from './laboratory-operational-access.decorator';

describe('LaboratoryOperationalAccess', () => {
  const reflector = new Reflector();

  @LaboratoryOperationalAccess()
  class ProtectedLaboratoryController {}

  it('should enforce authentication, lab-admin role and laboratory approval', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProtectedLaboratoryController),
    ).toEqual([JwtAuthGuard, RolesGuard, LaboratoryApprovedGuard]);
    expect(
      reflector.get<UserRole[]>(ROLES_KEY, ProtectedLaboratoryController),
    ).toEqual([UserRole.LAB_ADMIN]);
  });
});
