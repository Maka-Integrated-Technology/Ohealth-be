import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

export interface IOrganizationAuthContext {
  organization_id: string;
  organization_type: string;
  membership_role: OrganizationMembershipRole;
  membership_status: OrganizationMembershipStatus;
  verification_status: OrganizationVerificationStatus;
  capabilities: string[];
}

export interface ICanonicalAuthContext {
  user_id: string;
  account_status: AccountStatus;
  email_verified: boolean;
  personas: UserPersonaType[];
  organizations: IOrganizationAuthContext[];
  professional_verification_status: ProfessionalVerificationStatus | null;
  capabilities: string[];
}

/**
 * Issue #80 foundation: derive context from the database, not client claims,
 * JWT role arrays, frontend route names, or uncontrolled permission overrides.
 * NOT connected to live login/refresh until #77 and API compatibility are ready.
 */
@Injectable()
export class CanonicalAuthContextService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserPersona)
    private readonly personas: Repository<UserPersona>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(Professional)
    private readonly professionals: Repository<Professional>,
    private readonly accessPolicy: AccountAccessPolicyService,
  ) {}

  async resolve(userId: string): Promise<ICanonicalAuthContext> {
    const user = await this.users.findOne({ where: { id: userId } });
    this.accessPolicy.assertCanAuthenticate(user);
    // assertCanAuthenticate throws if missing: fail closed and avoid any
    // permissions lookup for a suspended or pending user.
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }
    const [personaRows, membershipRows, professional] = await Promise.all([
      this.personas.find({ where: { user_id: user.id, is_active: true } }),
      this.memberships.find({
        where: { user_id: user.id },
        relations: { organization: true },
      }),
      this.professionals.findOne({ where: { user_id: user.id } }),
    ]);

    const personaTypes = [
      ...new Set(personaRows.map((item) => item.persona_type)),
    ];
    const capabilities = new Set<string>();

    if (personaTypes.includes(UserPersonaType.PATIENT)) {
      capabilities.add('patient.profile.read');
      capabilities.add('patient.profile.update');
    }

    const professionalVerified =
      personaTypes.includes(UserPersonaType.HEALTHCARE_PROFESSIONAL) &&
      professional?.is_active &&
      professional.verification_status ===
        ProfessionalVerificationStatus.VERIFIED;

    if (professionalVerified) {
      capabilities.add('professional.consultations.manage');
    }

    const organizations: IOrganizationAuthContext[] = membershipRows
      .filter((row) => Boolean(row.organization))
      .map((membership) => {
        const organization = membership.organization;
        const allowed =
          membership.status === OrganizationMembershipStatus.ACTIVE &&
          organization.is_active &&
          organization.verification_status ===
            OrganizationVerificationStatus.APPROVED;
        const membershipCapabilities: string[] = [];
        if (allowed) {
          membershipCapabilities.push('organization.dashboard.read');
          if (
            membership.role === OrganizationMembershipRole.OWNER ||
            membership.role === OrganizationMembershipRole.ADMIN
          ) {
            membershipCapabilities.push('organization.settings.manage');
          }
        }
        return {
          organization_id: organization.id,
          organization_type: organization.organization_type,
          membership_role: membership.role,
          membership_status: membership.status,
          verification_status: organization.verification_status,
          capabilities: membershipCapabilities,
        };
      });

    return {
      user_id: user.id,
      account_status: user.account_status,
      email_verified: Boolean(user.email_verified_at),
      personas: personaTypes,
      organizations,
      professional_verification_status:
        professional?.verification_status ?? null,
      capabilities: [...capabilities],
    };
  }

  async assertOrganizationCapability(
    userId: string,
    organizationId: string,
    capability: 'organization.dashboard.read' | 'organization.settings.manage',
  ): Promise<void> {
    if (!organizationId) {
      throw new ForbiddenException('Organization membership is required.');
    }
    const context = await this.resolve(userId);
    const membership = context.organizations.find(
      (item) => item.organization_id === organizationId,
    );
    if (!membership?.capabilities.includes(capability)) {
      throw new ForbiddenException('Organization permission denied.');
    }
  }

  async assertCanReadPatientProfile(userId: string): Promise<void> {
    const context = await this.resolve(userId);
    if (!context.capabilities.includes('patient.profile.read')) {
      throw new ForbiddenException('Patient profile access required.');
    }
  }

  async assertCanEditPatientProfile(userId: string): Promise<void> {
    const context = await this.resolve(userId);
    if (!context.capabilities.includes('patient.profile.update')) {
      throw new ForbiddenException('Patient profile access required.');
    }
  }
}
