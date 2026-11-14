import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AuthContextService } from '../../auth/context/auth-context.service';
import { UserRole } from '../../user/enums/user-role.enum';
import { OrganizationAdmin } from '../entities/organization-admin.entity';
import { OrganizationType } from '../enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

import { OrganizationApprovedGuard } from './organization-approved.guard';

describe('OrganizationApprovedGuard', () => {
  const repository = { findOne: jest.fn() };
  const createContext = (roles: UserRole[]) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'user-id',
            userId: 'user-id',
            roles,
            sessionId: 'session-id',
          },
        }),
      }),
    }) as ExecutionContext;
  const guard = new OrganizationApprovedGuard(
    repository as unknown as Repository<OrganizationAdmin>,
    {
      resolve: jest.fn().mockResolvedValue({
        memberships: [
          {
            organization_id: 'organization-id',
            role: 'admin',
          },
        ],
      }),
    } as unknown as AuthContextService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows an approved administrator with the matching role', async () => {
    repository.findOne.mockResolvedValue({
      organization: {
        id: 'organization-id',
        organization_type: OrganizationType.PHARMACY,
        verification_status: OrganizationVerificationStatus.APPROVED,
        is_active: true,
      },
    });

    await expect(
      guard.canActivate(createContext([UserRole.PHARMACY_ADMIN])),
    ).resolves.toBe(true);
  });

  it('denies access before approval', async () => {
    repository.findOne.mockResolvedValue({
      organization: {
        id: 'organization-id',
        organization_type: OrganizationType.PHARMACY,
        verification_status: OrganizationVerificationStatus.UNDER_REVIEW,
        is_active: true,
      },
    });

    await expect(
      guard.canActivate(createContext([UserRole.PHARMACY_ADMIN])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies a role that does not match the linked organization type', async () => {
    repository.findOne.mockResolvedValue({
      organization: {
        id: 'other-organization-id',
        organization_type: OrganizationType.HOSPITAL,
        verification_status: OrganizationVerificationStatus.APPROVED,
        is_active: true,
      },
    });

    await expect(
      guard.canActivate(createContext([UserRole.PHARMACY_ADMIN])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies an inactive organization even when approved', async () => {
    repository.findOne.mockResolvedValue({
      organization: {
        id: 'organization-id',
        organization_type: OrganizationType.PHARMACY,
        verification_status: OrganizationVerificationStatus.APPROVED,
        is_active: false,
      },
    });

    await expect(
      guard.canActivate(createContext([UserRole.PHARMACY_ADMIN])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
