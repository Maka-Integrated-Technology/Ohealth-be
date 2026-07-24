import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LaboratoryAdmin } from '../laboratory/entities/laboratory-admin.entity';
import { LaboratoryStaff } from '../laboratory/entities/laboratory-staff.entity';
import { LaboratoryStaffStatus } from '../laboratory/enums/laboratory-post-approval.enum';
import { LaboratoryVerificationStatus } from '../laboratory/enums/laboratory-verification-status.enum';
import { ORGANIZATION_ADMIN_ROLE } from '../organization/constants/organization-role.constant';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { OrganizationType } from '../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../organization/enums/organization-verification-status.enum';
import {
  Professional,
  ProfessionalVerificationStatus,
} from '../professional/entities/professional.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { AuthAccessLevel, AuthRoutingTarget } from './enums/auth-routing.enum';
import { IAuthRoutingResult } from './interfaces/auth-routing-result.interface';

const PROFESSIONAL_ROLES = new Set<UserRole>([
  UserRole.DOCTOR,
  UserRole.THERAPIST,
  UserRole.COUNSELLOR,
  UserRole.LAB_PROFESSIONAL,
]);

const ORGANIZATION_ROLES = new Set<UserRole>(
  Object.values(ORGANIZATION_ADMIN_ROLE),
);

const ORGANIZATION_VERIFICATION_TARGET: Readonly<
  Record<OrganizationType, AuthRoutingTarget>
> = {
  [OrganizationType.HOSPITAL]: AuthRoutingTarget.HOSPITAL_VERIFICATION,
  [OrganizationType.LABORATORY]: AuthRoutingTarget.LABORATORY_VERIFICATION,
  [OrganizationType.PHARMACY]: AuthRoutingTarget.PHARMACY_VERIFICATION,
};

const ORGANIZATION_DASHBOARD_TARGET: Readonly<
  Record<OrganizationType, AuthRoutingTarget>
> = {
  [OrganizationType.HOSPITAL]: AuthRoutingTarget.HOSPITAL_DASHBOARD,
  [OrganizationType.LABORATORY]: AuthRoutingTarget.LABORATORY_DASHBOARD,
  [OrganizationType.PHARMACY]: AuthRoutingTarget.PHARMACY_DASHBOARD,
};

@Injectable()
export class AuthRoutingService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(OrganizationAdmin)
    private readonly organizationAdminRepository: Repository<OrganizationAdmin>,
    @InjectRepository(LaboratoryAdmin)
    private readonly legacyLaboratoryAdminRepository: Repository<LaboratoryAdmin>,
    @InjectRepository(LaboratoryStaff)
    private readonly laboratoryStaffRepository: Repository<LaboratoryStaff>,
  ) {}

  async resolve(user: User): Promise<IAuthRoutingResult> {
    if (!user.is_verified) {
      return this.limited(AuthRoutingTarget.EMAIL_VERIFICATION);
    }

    const roles = new Set(user.role ?? []);
    if (!roles.size) {
      return this.limited(AuthRoutingTarget.ACCOUNT_SETUP);
    }

    if (roles.size === 1 && roles.has(UserRole.ADMIN)) {
      return this.full(AuthRoutingTarget.ADMIN_DASHBOARD);
    }

    if (roles.size === 1 && roles.has(UserRole.LAB_STAFF)) {
      return this.resolveLaboratoryStaff(user.id);
    }

    if (
      roles.size === 1 &&
      [...roles].some((role) => ORGANIZATION_ROLES.has(role))
    ) {
      return this.resolveOrganizationAdministrator(user.id, [...roles][0]);
    }

    if ([...roles].every((role) => PROFESSIONAL_ROLES.has(role))) {
      return this.resolveProfessional(user.id);
    }

    if (roles.size === 1 && roles.has(UserRole.PATIENT)) {
      return this.full(AuthRoutingTarget.PATIENT_HOME);
    }

    return this.limited(AuthRoutingTarget.ACCOUNT_SETUP);
  }

  private async resolveProfessional(
    userId: string,
  ): Promise<IAuthRoutingResult> {
    const professional = await this.professionalRepository.findOne({
      where: { user_id: userId },
      select: { is_active: true, verification_status: true },
    });
    const verificationStatus = professional?.verification_status ?? null;
    if (professional && !professional.is_active) {
      return this.limited(
        AuthRoutingTarget.ACCOUNT_RESTRICTED,
        verificationStatus,
      );
    }

    if (verificationStatus === ProfessionalVerificationStatus.VERIFIED) {
      return this.full(
        AuthRoutingTarget.PROFESSIONAL_DASHBOARD,
        verificationStatus,
      );
    }

    return this.limited(
      AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
      verificationStatus,
    );
  }

  private async resolveOrganizationAdministrator(
    userId: string,
    role: UserRole,
  ): Promise<IAuthRoutingResult> {
    const administrator = await this.organizationAdminRepository.findOne({
      where: { user_id: userId },
      relations: { organization: true },
    });

    if (administrator?.organization) {
      const organization = administrator.organization;
      if (ORGANIZATION_ADMIN_ROLE[organization.organization_type] !== role) {
        return this.limited(AuthRoutingTarget.ACCOUNT_SETUP);
      }
      if (!organization.is_active) {
        return this.limited(
          AuthRoutingTarget.ACCOUNT_RESTRICTED,
          organization.verification_status,
        );
      }

      const target =
        organization.verification_status ===
        OrganizationVerificationStatus.APPROVED
          ? ORGANIZATION_DASHBOARD_TARGET[organization.organization_type]
          : ORGANIZATION_VERIFICATION_TARGET[organization.organization_type];

      return organization.verification_status ===
        OrganizationVerificationStatus.APPROVED
        ? this.full(target, organization.verification_status)
        : this.limited(target, organization.verification_status);
    }

    if (role === UserRole.LAB_ADMIN) {
      return this.resolveLegacyLaboratoryAdministrator(userId);
    }

    return this.limited(AuthRoutingTarget.ACCOUNT_SETUP);
  }

  private async resolveLegacyLaboratoryAdministrator(
    userId: string,
  ): Promise<IAuthRoutingResult> {
    const administrator = await this.legacyLaboratoryAdminRepository.findOne({
      where: { user_id: userId },
      relations: { laboratory: true },
    });
    const laboratory = administrator?.laboratory;
    if (!laboratory) {
      return this.limited(AuthRoutingTarget.ACCOUNT_SETUP);
    }
    if (!laboratory.is_active) {
      return this.limited(
        AuthRoutingTarget.ACCOUNT_RESTRICTED,
        laboratory.verification_status,
      );
    }

    if (
      laboratory.verification_status === LaboratoryVerificationStatus.APPROVED
    ) {
      return this.full(
        AuthRoutingTarget.LABORATORY_DASHBOARD,
        laboratory.verification_status,
      );
    }

    return this.limited(
      AuthRoutingTarget.LABORATORY_VERIFICATION,
      laboratory.verification_status,
    );
  }

  private async resolveLaboratoryStaff(
    userId: string,
  ): Promise<IAuthRoutingResult> {
    const staff = await this.laboratoryStaffRepository.findOne({
      where: { user_id: userId },
      relations: { organization: true },
    });
    if (!staff?.organization) {
      return this.limited(AuthRoutingTarget.ACCOUNT_SETUP);
    }
    const organization = staff.organization;
    if (
      staff.status !== LaboratoryStaffStatus.ACTIVE ||
      organization.organization_type !== OrganizationType.LABORATORY ||
      !organization.is_active
    ) {
      return this.limited(
        AuthRoutingTarget.ACCOUNT_RESTRICTED,
        organization.verification_status,
      );
    }
    return organization.verification_status ===
      OrganizationVerificationStatus.APPROVED
      ? this.full(
          AuthRoutingTarget.LABORATORY_DASHBOARD,
          organization.verification_status,
        )
      : this.limited(
          AuthRoutingTarget.LABORATORY_VERIFICATION,
          organization.verification_status,
        );
  }

  private full(
    routingTarget: AuthRoutingTarget,
    verificationStatus: string | null = null,
  ): IAuthRoutingResult {
    return {
      routing_target: routingTarget,
      access_level: AuthAccessLevel.FULL,
      verification_status: verificationStatus,
    };
  }

  private limited(
    routingTarget: AuthRoutingTarget,
    verificationStatus: string | null = null,
  ): IAuthRoutingResult {
    return {
      routing_target: routingTarget,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: verificationStatus,
    };
  }
}
