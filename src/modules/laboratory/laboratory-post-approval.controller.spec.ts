import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationApprovedGuard } from '../organization/guards/organization-approved.guard';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryPostApprovalController } from './laboratory-post-approval.controller';

describe('LaboratoryPostApprovalController access', () => {
  const reflector = new Reflector();
  const protectedMethods = [
    'setOperatingHours',
    'listOperatingHours',
    'createTest',
    'listTests',
    'updateTest',
    'inviteStaff',
    'listStaff',
  ] as const;

  it.each(protectedMethods)(
    'restricts %s to approved laboratory administrators',
    (method) => {
      const handler = LaboratoryPostApprovalController.prototype[method];

      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        JwtAuthGuard,
        RolesGuard,
        OrganizationApprovedGuard,
      ]);
      expect(reflector.get<UserRole[]>(ROLES_KEY, handler)).toEqual([
        UserRole.LAB_ADMIN,
      ]);
    },
  );

  it('keeps invitation acceptance public', () => {
    expect(
      reflector.get<boolean>(
        IS_PUBLIC_KEY,
        LaboratoryPostApprovalController.prototype.acceptStaffInvitation,
      ),
    ).toBe(true);
  });
});
