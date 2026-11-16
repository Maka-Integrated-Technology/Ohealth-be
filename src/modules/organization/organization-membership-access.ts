import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { OrganizationMembership } from './entities/organization-membership.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationMembershipRole } from './enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from './enums/organization-membership-status.enum';

export async function findAdministrativeOrganization(
  memberships: Repository<OrganizationMembership>,
  userId: string,
  organizationId: string,
): Promise<Organization> {
  if (!organizationId) {
    throw new ForbiddenException('active organization is required');
  }
  const membership = await memberships.findOne({
    where: {
      user_id: userId,
      organization_id: organizationId,
      status: OrganizationMembershipStatus.ACTIVE,
    },
    relations: { organization: true },
  });
  if (
    !membership?.organization?.is_active ||
    ![
      OrganizationMembershipRole.OWNER,
      OrganizationMembershipRole.ADMIN,
    ].includes(membership.role)
  ) {
    throw new ForbiddenException(
      'active organization administrator membership required',
    );
  }
  return membership.organization;
}
