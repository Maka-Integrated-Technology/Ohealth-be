import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import {
  Professional,
  ProfessionalVerificationStatus,
} from '../../professional/entities/professional.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AccountAccessPolicyService } from '../account-access-policy.service';

import { CanonicalAuthContextService } from './canonical-auth-context.service';

describe('CanonicalAuthContextService', () => {
  const users = { findOne: jest.fn() };
  const personas = { find: jest.fn() };
  const memberships = { find: jest.fn() };
  const professionals = { findOne: jest.fn() };
  const policy = new AccountAccessPolicyService();
  const service = new CanonicalAuthContextService(
    users as unknown as Repository<User>,
    personas as unknown as Repository<UserPersona>,
    memberships as unknown as Repository<OrganizationMembership>,
    professionals as unknown as Repository<Professional>,
    policy,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue({
      id: 'person-1',
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      role: ['ADMIN'],
    });
    personas.find.mockResolvedValue([]);
    memberships.find.mockResolvedValue([]);
    professionals.findOne.mockResolvedValue(null);
  });

  it('fails closed on pending, suspended, and deactivated accounts', async () => {
    for (const status of [
      AccountStatus.PENDING_VERIFICATION,
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
    ]) {
      users.findOne.mockResolvedValueOnce({
        id: 'person-1',
        account_status: status,
        email_verified_at: new Date(),
      });
      await expect(service.resolve('person-1')).rejects.toThrow(
        UnauthorizedException,
      );
    }
    expect(personas.find).not.toHaveBeenCalled();
    expect(memberships.find).not.toHaveBeenCalled();
  });

  it('never trusts a user legacy ADMIN role as a capability', async () => {
    const context = await service.resolve('person-1');
    expect(context.capabilities).toEqual([]);
    expect(context.organizations).toEqual([]);
    expect(context).not.toHaveProperty('routing_target');
  });

  it('grants only patient profile abilities to an active patient persona', async () => {
    personas.find.mockResolvedValueOnce([
      { persona_type: UserPersonaType.PATIENT, is_active: true },
    ]);
    const context = await service.resolve('person-1');
    expect(context.capabilities).toEqual([
      'patient.profile.read',
      'patient.profile.update',
    ]);
    expect(context.personas).toEqual([UserPersonaType.PATIENT]);
  });

  it('does not grant professional privileges until verified and active', async () => {
    personas.find.mockResolvedValue([
      { persona_type: UserPersonaType.HEALTHCARE_PROFESSIONAL },
    ]);
    professionals.findOne.mockResolvedValue({
      is_active: true,
      verification_status: ProfessionalVerificationStatus.PENDING,
    });
    expect((await service.resolve('person-1')).capabilities).toEqual([]);
    professionals.findOne.mockResolvedValue({
      is_active: true,
      verification_status: ProfessionalVerificationStatus.VERIFIED,
    });
    expect((await service.resolve('person-1')).capabilities).toEqual([
      'professional.consultations.manage',
    ]);
  });

  it('scopes membership and permissions per approved organization', async () => {
    memberships.find.mockResolvedValue([
      {
        status: OrganizationMembershipStatus.ACTIVE,
        role: OrganizationMembershipRole.OWNER,
        permission_overrides: ['platform.admin'],
        organization: {
          id: 'approved-org',
          organization_type: 'hospital',
          is_active: true,
          verification_status: OrganizationVerificationStatus.APPROVED,
        },
      },
      {
        status: OrganizationMembershipStatus.ACTIVE,
        role: OrganizationMembershipRole.ADMIN,
        organization: {
          id: 'pending-org',
          organization_type: 'pharmacy',
          is_active: true,
          verification_status: OrganizationVerificationStatus.PENDING,
        },
      },
      {
        status: OrganizationMembershipStatus.SUSPENDED,
        role: OrganizationMembershipRole.OWNER,
        organization: {
          id: 'suspended-org',
          organization_type: 'laboratory',
          is_active: true,
          verification_status: OrganizationVerificationStatus.APPROVED,
        },
      },
    ]);
    const context = await service.resolve('person-1');
    expect(context.organizations).toMatchObject([
      {
        organization_id: 'approved-org',
        capabilities: [
          'organization.dashboard.read',
          'organization.settings.manage',
        ],
      },
      { organization_id: 'pending-org', capabilities: [] },
      { organization_id: 'suspended-org', capabilities: [] },
    ]);
    expect(context.capabilities).not.toContain('platform.admin');
  });

  it('rejects cross-organization access and pending organization administrators', async () => {
    memberships.find.mockResolvedValue([
      {
        status: OrganizationMembershipStatus.ACTIVE,
        role: OrganizationMembershipRole.MEMBER,
        organization: {
          id: 'org-owned-by-actor',
          organization_type: 'hospital',
          is_active: true,
          verification_status: OrganizationVerificationStatus.APPROVED,
        },
      },
      {
        status: OrganizationMembershipStatus.ACTIVE,
        role: OrganizationMembershipRole.OWNER,
        organization: {
          id: 'org-awaiting-review',
          organization_type: 'pharmacy',
          is_active: true,
          verification_status: OrganizationVerificationStatus.PENDING,
        },
      },
    ]);
    await expect(
      service.assertOrganizationCapability(
        'person-1',
        'org-owned-by-actor',
        'organization.dashboard.read',
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertOrganizationCapability(
        'person-1',
        'org-owned-by-actor',
        'organization.settings.manage',
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.assertOrganizationCapability(
        'person-1',
        'org-awaiting-review',
        'organization.dashboard.read',
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.assertOrganizationCapability(
        'person-1',
        'unrelated-org',
        'organization.dashboard.read',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('enforces patient profile checks from canonical persona state', async () => {
    await expect(
      service.assertCanEditPatientProfile('person-1'),
    ).rejects.toThrow(ForbiddenException);
    personas.find.mockResolvedValueOnce([
      { persona_type: UserPersonaType.PATIENT },
    ]);
    await expect(
      service.assertCanEditPatientProfile('person-1'),
    ).resolves.toBeUndefined();
  });
});
