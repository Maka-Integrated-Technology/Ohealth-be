import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { AUTH_CAPABILITIES_KEY } from '../auth/decorators/capabilities.decorator';
import { AuthCapability } from '../auth/context/auth-capability';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { OrganizationController } from './organization.controller';

describe('OrganizationController', () => {
  const reflector = new Reflector();

  it('protects every route with JWT and capability enforcement', () => {
    expect(Reflect.getMetadata('__guards__', OrganizationController)).toEqual([
      JwtAuthGuard,
      CapabilitiesGuard,
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
        reflector.get(
          AUTH_CAPABILITIES_KEY,
          OrganizationController.prototype[method],
        ),
      ).toEqual([AuthCapability.PLATFORM_ORGANIZATION_REVIEW]);
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
        reflector.get(
          AUTH_CAPABILITIES_KEY,
          OrganizationController.prototype[method],
        ),
      ).toEqual([AuthCapability.ORGANIZATION_ONBOARDING]);
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
