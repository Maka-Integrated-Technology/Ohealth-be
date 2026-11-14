import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import {
  Professional,
  ProfessionalVerificationStatus,
} from '../../professional/entities/professional.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AuthSession } from '../entities/auth.entity';

import { AuthCapability } from './auth-capability';
import { IAuthAccountContext } from './auth-context.types';
import { PlatformPrivilegeEntity } from './platform-privilege.entity';
import { PlatformPrivilege } from './platform-privilege.enum';

@Injectable()
export class AuthContextService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserPersona)
    private readonly personas: Repository<UserPersona>,
    @InjectRepository(Professional)
    private readonly professionals: Repository<Professional>,
    @InjectRepository(PatientProfile)
    private readonly patientProfiles: Repository<PatientProfile>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    @InjectRepository(PlatformPrivilegeEntity)
    private readonly platformPrivileges: Repository<PlatformPrivilegeEntity>,
  ) {}

  async resolve(
    userId: string,
    sessionId: string,
  ): Promise<IAuthAccountContext> {
    const [
      user,
      personas,
      professional,
      patientProfile,
      memberships,
      session,
      platformPrivileges,
    ] = await Promise.all([
      this.users.findOne({ where: { id: userId } }),
      this.personas.find({ where: { user_id: userId, is_active: true } }),
      this.professionals.findOne({ where: { user_id: userId } }),
      this.patientProfiles.findOne({ where: { user_id: userId } }),
      this.memberships.find({
        where: { user_id: userId },
        relations: { organization: true },
      }),
      this.sessions.findOne({
        where: { user_id: userId, session_id: sessionId, revoked_at: IsNull() },
      }),
      this.platformPrivileges.find({ where: { user_id: userId } }),
    ]);

    if (!user || !session || session.expires_at <= new Date()) {
      throw new NotFoundException('authenticated account context not found');
    }
    if (
      user.account_status !== AccountStatus.ACTIVE ||
      !user.email_verified_at
    ) {
      throw new ForbiddenException('account is not active');
    }

    const activePersonas = personas.filter((persona) => persona.is_active);
    const activeMemberships = memberships.filter(
      (membership) =>
        membership.status === OrganizationMembershipStatus.ACTIVE &&
        membership.organization,
    );
    const capabilities = new Set<string>([
      AuthCapability.ACCOUNT_CONTEXT_READ,
      AuthCapability.ACCOUNT_PROFILE_READ,
      AuthCapability.ACCOUNT_PROFILE_UPDATE,
    ]);

    if (
      platformPrivileges.some(
        (privilege) => privilege.privilege === PlatformPrivilege.ADMIN,
      )
    ) {
      capabilities.add(AuthCapability.PLATFORM_ADMIN);
      capabilities.add(AuthCapability.PLATFORM_ORGANIZATION_REVIEW);
      capabilities.add(AuthCapability.PLATFORM_PROFESSIONAL_REVIEW);
      capabilities.add(AuthCapability.PLATFORM_SPECIALITY_MANAGE);
    }

    if (this.hasPersona(activePersonas, UserPersonaType.PATIENT)) {
      capabilities.add(AuthCapability.PERSONA_PATIENT);
      capabilities.add(AuthCapability.PATIENT_BOOKINGS);
      capabilities.add(AuthCapability.PATIENT_REVIEW_PROFESSIONAL);
    }

    if (
      professional &&
      this.hasPersona(activePersonas, UserPersonaType.HEALTHCARE_PROFESSIONAL)
    ) {
      capabilities.add(AuthCapability.PERSONA_PROFESSIONAL);
      capabilities.add(AuthCapability.PROFESSIONAL_ONBOARDING);
      capabilities.add(AuthCapability.PROFESSIONAL_VERIFICATION);
      if (
        professional.is_active &&
        professional.verification_status ===
          ProfessionalVerificationStatus.VERIFIED
      ) {
        capabilities.add(AuthCapability.PROFESSIONAL_OPERATIONAL);
        capabilities.add(AuthCapability.PROFESSIONAL_PATIENT_CARE);
      }
    }

    for (const membership of activeMemberships) {
      const organization = membership.organization;
      if (!organization.is_active) continue;
      capabilities.add(AuthCapability.ORGANIZATION_MEMBER);
      if (
        membership.role === OrganizationMembershipRole.OWNER ||
        membership.role === OrganizationMembershipRole.ADMIN
      ) {
        capabilities.add(AuthCapability.ORGANIZATION_ADMIN);
        capabilities.add(AuthCapability.ORGANIZATION_ONBOARDING);
      }
      if (
        organization.verification_status ===
        OrganizationVerificationStatus.APPROVED
      ) {
        capabilities.add(AuthCapability.ORGANIZATION_OPERATIONAL);
      }
    }

    return {
      account: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        status: user.account_status,
        email_verified: Boolean(user.email_verified_at),
        created_at: user.created_at,
        profile: {
          middle_name: user.middle_name ?? null,
          gender: user.gender ?? null,
          dob: user.dob ?? null,
          phone: user.phone ?? null,
          country: user.country ?? null,
          address: patientProfile?.address ?? null,
          image: user.image ?? null,
          updated_at: user.updated_at,
        },
      },
      personas: activePersonas.map((persona) => ({
        type: persona.persona_type,
        is_active: persona.is_active,
      })),
      professional: professional
        ? {
            verification_status: professional.verification_status,
            profile_setup_completed: professional.profile_setup_completed,
            is_active: professional.is_active,
          }
        : null,
      memberships: activeMemberships.map((membership) => ({
        organization_id: membership.organization_id,
        organization_type: membership.organization.organization_type,
        organization_name: membership.organization.name,
        organization_verification_status:
          membership.organization.verification_status,
        organization_is_active: membership.organization.is_active,
        role: membership.role,
        status: membership.status,
        permission_overrides: membership.permission_overrides ?? [],
      })),
      capabilities: [...capabilities].sort(),
      session: {
        id: session.session_id,
        expires_at: session.expires_at,
        last_used_at: session.last_used_at ?? null,
      },
    };
  }

  async assertCapabilities(
    userId: string,
    sessionId: string,
    required: readonly string[],
  ): Promise<IAuthAccountContext> {
    const context = await this.resolve(userId, sessionId);
    if (
      !required.every((capability) => context.capabilities.includes(capability))
    ) {
      throw new ForbiddenException(
        'required account capability is unavailable',
      );
    }
    return context;
  }

  private hasPersona(personas: UserPersona[], type: UserPersonaType): boolean {
    return personas.some((persona) => persona.persona_type === type);
  }
}
