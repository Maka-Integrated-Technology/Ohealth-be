import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

import { ORGANIZATION_ADMIN_ROLES } from './constants/organization-role.constant';
import { OrganizationController } from './organization.controller';

describe('OrganizationController', () => {
  const reflector = new Reflector();

  it('protects every route with JWT and role enforcement', () => {
    expect(Reflect.getMetadata('__guards__', OrganizationController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('restricts setup and review actions to platform administrators', () => {
    const methods = [
      'setup',
      'listApplications',
      'listForReview',
      'downloadForReview',
      'getStatus',
      'listHistory',
      'markUnderReview',
      'approve',
      'reject',
    ] as const;

    methods.forEach((method) => {
      expect(
        reflector.get(ROLES_KEY, OrganizationController.prototype[method]),
      ).toEqual([UserRole.ADMIN]);
    });
  });

  it('restricts owner actions to organization administrators', () => {
    const methods = [
      'uploadMine',
      'listMine',
      'downloadMine',
      'deleteMine',
      'getMyStatus',
      'submitMine',
    ] as const;

    methods.forEach((method) => {
      expect(
        reflector.get(ROLES_KEY, OrganizationController.prototype[method]),
      ).toEqual(ORGANIZATION_ADMIN_ROLES);
    });
  });

  it('returns OK for upload and status transitions', () => {
    const methods = [
      'uploadMine',
      'submitMine',
      'markUnderReview',
      'approve',
      'reject',
    ] as const;

    methods.forEach((method) => {
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          OrganizationController.prototype[method],
        ),
      ).toBe(200);
    });
  });
});
