import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthCapability } from '../auth/context/auth-capability';
import { AUTH_CAPABILITIES_KEY } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationApprovedGuard } from '../organization/guards/organization-approved.guard';

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
        CapabilitiesGuard,
        OrganizationApprovedGuard,
      ]);
      expect(
        reflector.get<AuthCapability[]>(AUTH_CAPABILITIES_KEY, handler),
      ).toEqual([AuthCapability.ORGANIZATION_OPERATIONAL]);
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
