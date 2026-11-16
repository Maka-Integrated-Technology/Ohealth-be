import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { AuthContextService } from '../../auth/context/auth-context.service';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

import { OrganizationApprovedGuard } from './organization-approved.guard';

describe('OrganizationApprovedGuard', () => {
  const contexts = { resolve: jest.fn() };
  const guard = new OrganizationApprovedGuard(
    contexts as unknown as AuthContextService,
  );
  const request = {
    headers: { ['x-organization-id']: 'organization-id' },
    user: { id: 'user-id', sessionId: 'session-id' },
  };
  const executionContext = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers['x-organization-id'] = 'organization-id';
    contexts.resolve.mockResolvedValue({
      memberships: [
        {
          organization_id: 'organization-id',
          role: 'owner',
          organization_is_active: true,
          organization_verification_status:
            OrganizationVerificationStatus.APPROVED,
        },
      ],
    });
  });

  it('requires the selected approved organization membership', async () => {
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(contexts.resolve).toHaveBeenCalledWith(
      'user-id',
      'session-id',
      'organization-id',
    );
  });

  it.each([
    { organization_id: 'other-id' },
    { role: 'member' },
    { organization_is_active: false },
    {
      organization_verification_status: OrganizationVerificationStatus.PENDING,
    },
  ])('denies an ineligible membership: %j', async (change) => {
    contexts.resolve.mockResolvedValue({
      memberships: [
        {
          organization_id: 'organization-id',
          role: 'owner',
          organization_is_active: true,
          organization_verification_status:
            OrganizationVerificationStatus.APPROVED,
          ...change,
        },
      ],
    });
    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies a missing selector', async () => {
    request.headers['x-organization-id'] = '';
    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(contexts.resolve).not.toHaveBeenCalled();
  });
});
