import { ForbiddenException } from '@nestjs/common';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { ProfessionalVerificationStatus } from '../../professional/entities/professional.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';

import { AuthCapability } from './auth-capability';
import { AuthContextService } from './auth-context.service';
import { PlatformPrivilege } from './platform-privilege.enum';

describe('AuthContextService', () => {
  const user = {
    id: 'user-id',
    email: 'person@example.com',
    first_name: 'Person',
    last_name: 'User',
    role: ['ADMIN'],
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    created_at: new Date(),
  };
  const users = { findOne: jest.fn() };
  const personas = { find: jest.fn() };
  const professionals = { findOne: jest.fn() };
  const patientProfiles = { findOne: jest.fn() };
  const memberships = { find: jest.fn() };
  const sessions = { findOne: jest.fn() };
  const platformPrivileges = { find: jest.fn() };
  let service: AuthContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue(user);
    personas.find.mockResolvedValue([
      {
        persona_type: UserPersonaType.HEALTHCARE_PROFESSIONAL,
        is_active: true,
      },
    ]);
    professionals.findOne.mockResolvedValue({
      verification_status: ProfessionalVerificationStatus.PENDING,
      profile_setup_completed: false,
      is_active: true,
    });
    patientProfiles.findOne.mockResolvedValue({ address: '12 Example Road' });
    memberships.find.mockResolvedValue([
      {
        organization_id: 'org-id',
        role: OrganizationMembershipRole.OWNER,
        status: OrganizationMembershipStatus.ACTIVE,
        permission_overrides: [],
        organization: {
          id: 'org-id',
          organization_type: OrganizationType.HOSPITAL,
          name: 'Hospital',
          verification_status: OrganizationVerificationStatus.PENDING,
          is_active: true,
        },
      },
    ]);
    sessions.findOne.mockResolvedValue({
      session_id: 'session-id',
      expires_at: new Date(Date.now() + 60_000),
      last_used_at: null,
      revoked_at: null,
    });
    platformPrivileges.find.mockResolvedValue([]);
    service = new AuthContextService(
      users as never,
      personas as never,
      professionals as never,
      patientProfiles as never,
      memberships as never,
      sessions as never,
      platformPrivileges as never,
    );
  });

  it('derives pending professional access without consulting legacy roles', async () => {
    const context = await service.resolve('user-id', 'session-id');

    expect(context.capabilities).toEqual(
      expect.arrayContaining([
        AuthCapability.PROFESSIONAL_ONBOARDING,
        AuthCapability.PROFESSIONAL_VERIFICATION,
        AuthCapability.ORGANIZATION_ONBOARDING,
      ]),
    );
    expect(context.capabilities).not.toContain(
      AuthCapability.PROFESSIONAL_OPERATIONAL,
    );
    expect(context.account.id).toBe('user-id');
    expect(context.account.profile.address).toBe('12 Example Road');
    expect(context.memberships[0].organization_id).toBe('org-id');
  });

  it('derives platform capabilities only from the separate privilege record', async () => {
    platformPrivileges.find.mockResolvedValue([
      { privilege: PlatformPrivilege.ADMIN },
    ]);
    const context = await service.resolve('user-id', 'session-id');

    expect(context.capabilities).toEqual(
      expect.arrayContaining([
        AuthCapability.PLATFORM_ORGANIZATION_REVIEW,
        AuthCapability.PLATFORM_PROFESSIONAL_REVIEW,
        AuthCapability.PLATFORM_SPECIALITY_MANAGE,
      ]),
    );
  });

  it('fails closed for a non-active account', async () => {
    users.findOne.mockResolvedValue({
      ...user,
      account_status: AccountStatus.SUSPENDED,
    });

    await expect(
      service.resolve('user-id', 'session-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
