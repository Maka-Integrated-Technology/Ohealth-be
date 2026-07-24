import { Repository } from 'typeorm';

import { LaboratoryAdmin } from '../laboratory/entities/laboratory-admin.entity';
import { LaboratoryStaff } from '../laboratory/entities/laboratory-staff.entity';
import { LaboratoryStaffStatus } from '../laboratory/enums/laboratory-post-approval.enum';
import { LaboratoryVerificationStatus } from '../laboratory/enums/laboratory-verification-status.enum';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { OrganizationType } from '../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../organization/enums/organization-verification-status.enum';
import {
  Professional,
  ProfessionalVerificationStatus,
} from '../professional/entities/professional.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { AuthRoutingService } from './auth-routing.service';
import { AuthAccessLevel, AuthRoutingTarget } from './enums/auth-routing.enum';

describe('AuthRoutingService', () => {
  const professionalRepository = { findOne: jest.fn() };
  const organizationAdminRepository = { findOne: jest.fn() };
  const legacyLaboratoryAdminRepository = { findOne: jest.fn() };
  const laboratoryStaffRepository = { findOne: jest.fn() };
  const service = new AuthRoutingService(
    professionalRepository as unknown as Repository<Professional>,
    organizationAdminRepository as unknown as Repository<OrganizationAdmin>,
    legacyLaboratoryAdminRepository as unknown as Repository<LaboratoryAdmin>,
    laboratoryStaffRepository as unknown as Repository<LaboratoryStaff>,
  );

  const user = (role: UserRole[], isVerified = true) =>
    ({
      id: 'user-id',
      role,
      is_verified: isVerified,
    }) as User;

  beforeEach(() => {
    professionalRepository.findOne.mockReset();
    organizationAdminRepository.findOne.mockReset();
    legacyLaboratoryAdminRepository.findOne.mockReset();
    laboratoryStaffRepository.findOne.mockReset();
  });

  it('routes unverified accounts to email verification before profile lookup', async () => {
    await expect(
      service.resolve(user([UserRole.DOCTOR], false)),
    ).resolves.toEqual({
      routing_target: AuthRoutingTarget.EMAIL_VERIFICATION,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: null,
    });
    expect(professionalRepository.findOne).not.toHaveBeenCalled();
  });

  it.each([
    [UserRole.ADMIN, AuthRoutingTarget.ADMIN_DASHBOARD],
    [UserRole.PATIENT, AuthRoutingTarget.PATIENT_HOME],
  ])('routes %s to %s', async (role, target) => {
    await expect(service.resolve(user([role]))).resolves.toEqual({
      routing_target: target,
      access_level: AuthAccessLevel.FULL,
      verification_status: null,
    });
  });

  it.each([
    [
      ProfessionalVerificationStatus.PENDING,
      AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
      AuthAccessLevel.LIMITED,
    ],
    [
      ProfessionalVerificationStatus.REJECTED,
      AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
      AuthAccessLevel.LIMITED,
    ],
    [
      ProfessionalVerificationStatus.VERIFIED,
      AuthRoutingTarget.PROFESSIONAL_DASHBOARD,
      AuthAccessLevel.FULL,
    ],
  ])(
    'routes a %s professional to the correct access state',
    async (verificationStatus, target, accessLevel) => {
      professionalRepository.findOne.mockResolvedValue({
        is_active: true,
        verification_status: verificationStatus,
      });

      await expect(service.resolve(user([UserRole.DOCTOR]))).resolves.toEqual({
        routing_target: target,
        access_level: accessLevel,
        verification_status: verificationStatus,
      });
    },
  );

  it.each([
    [
      UserRole.HOSPITAL_ADMIN,
      OrganizationType.HOSPITAL,
      OrganizationVerificationStatus.PENDING,
      AuthRoutingTarget.HOSPITAL_VERIFICATION,
    ],
    [
      UserRole.PHARMACY_ADMIN,
      OrganizationType.PHARMACY,
      OrganizationVerificationStatus.REJECTED,
      AuthRoutingTarget.PHARMACY_VERIFICATION,
    ],
  ])(
    'routes a %s organization with %s status to limited verification',
    async (role, organizationType, verificationStatus, target) => {
      organizationAdminRepository.findOne.mockResolvedValue({
        organization: {
          organization_type: organizationType,
          verification_status: verificationStatus,
          is_active: true,
        },
      });

      await expect(service.resolve(user([role]))).resolves.toEqual({
        routing_target: target,
        access_level: AuthAccessLevel.LIMITED,
        verification_status: verificationStatus,
      });
    },
  );

  it('keeps a professional without a profile in limited access', async () => {
    professionalRepository.findOne.mockResolvedValue(null);

    await expect(service.resolve(user([UserRole.THERAPIST]))).resolves.toEqual({
      routing_target: AuthRoutingTarget.PROFESSIONAL_VERIFICATION,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: null,
    });
  });

  it('restricts an inactive professional even when verification is complete', async () => {
    professionalRepository.findOne.mockResolvedValue({
      is_active: false,
      verification_status: ProfessionalVerificationStatus.VERIFIED,
    });

    await expect(service.resolve(user([UserRole.DOCTOR]))).resolves.toEqual({
      routing_target: AuthRoutingTarget.ACCOUNT_RESTRICTED,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: ProfessionalVerificationStatus.VERIFIED,
    });
  });

  it.each([
    [
      UserRole.HOSPITAL_ADMIN,
      OrganizationType.HOSPITAL,
      AuthRoutingTarget.HOSPITAL_DASHBOARD,
    ],
    [
      UserRole.LAB_ADMIN,
      OrganizationType.LABORATORY,
      AuthRoutingTarget.LABORATORY_DASHBOARD,
    ],
    [
      UserRole.PHARMACY_ADMIN,
      OrganizationType.PHARMACY,
      AuthRoutingTarget.PHARMACY_DASHBOARD,
    ],
  ])(
    'routes an approved %s organization to %s',
    async (role, organizationType, target) => {
      organizationAdminRepository.findOne.mockResolvedValue({
        organization: {
          organization_type: organizationType,
          verification_status: OrganizationVerificationStatus.APPROVED,
          is_active: true,
        },
      });

      await expect(service.resolve(user([role]))).resolves.toEqual({
        routing_target: target,
        access_level: AuthAccessLevel.FULL,
        verification_status: OrganizationVerificationStatus.APPROVED,
      });
    },
  );

  it.each([
    OrganizationVerificationStatus.PENDING,
    OrganizationVerificationStatus.SUBMITTED,
    OrganizationVerificationStatus.UNDER_REVIEW,
    OrganizationVerificationStatus.REJECTED,
  ])(
    'keeps a laboratory with %s verification in limited access',
    async (verificationStatus) => {
      organizationAdminRepository.findOne.mockResolvedValue({
        organization: {
          organization_type: OrganizationType.LABORATORY,
          verification_status: verificationStatus,
          is_active: true,
        },
      });

      await expect(
        service.resolve(user([UserRole.LAB_ADMIN])),
      ).resolves.toEqual({
        routing_target: AuthRoutingTarget.LABORATORY_VERIFICATION,
        access_level: AuthAccessLevel.LIMITED,
        verification_status: verificationStatus,
      });
    },
  );

  it('restricts an inactive organization even when it is approved', async () => {
    organizationAdminRepository.findOne.mockResolvedValue({
      organization: {
        organization_type: OrganizationType.PHARMACY,
        verification_status: OrganizationVerificationStatus.APPROVED,
        is_active: false,
      },
    });

    await expect(
      service.resolve(user([UserRole.PHARMACY_ADMIN])),
    ).resolves.toEqual({
      routing_target: AuthRoutingTarget.ACCOUNT_RESTRICTED,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: OrganizationVerificationStatus.APPROVED,
    });
  });

  it('rejects a role that does not match the linked organization type', async () => {
    organizationAdminRepository.findOne.mockResolvedValue({
      organization: {
        organization_type: OrganizationType.HOSPITAL,
        verification_status: OrganizationVerificationStatus.APPROVED,
        is_active: true,
      },
    });

    await expect(
      service.resolve(user([UserRole.PHARMACY_ADMIN])),
    ).resolves.toEqual({
      routing_target: AuthRoutingTarget.ACCOUNT_SETUP,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: null,
    });
  });

  it('supports an existing approved legacy laboratory administrator', async () => {
    organizationAdminRepository.findOne.mockResolvedValue(null);
    legacyLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: {
        verification_status: LaboratoryVerificationStatus.APPROVED,
        is_active: true,
      },
    });

    await expect(service.resolve(user([UserRole.LAB_ADMIN]))).resolves.toEqual({
      routing_target: AuthRoutingTarget.LABORATORY_DASHBOARD,
      access_level: AuthAccessLevel.FULL,
      verification_status: LaboratoryVerificationStatus.APPROVED,
    });
  });

  it('routes active laboratory staff to the approved laboratory dashboard', async () => {
    laboratoryStaffRepository.findOne.mockResolvedValue({
      status: LaboratoryStaffStatus.ACTIVE,
      organization: {
        organization_type: OrganizationType.LABORATORY,
        verification_status: OrganizationVerificationStatus.APPROVED,
        is_active: true,
      },
    });

    await expect(service.resolve(user([UserRole.LAB_STAFF]))).resolves.toEqual({
      routing_target: AuthRoutingTarget.LABORATORY_DASHBOARD,
      access_level: AuthAccessLevel.FULL,
      verification_status: OrganizationVerificationStatus.APPROVED,
    });
  });

  it('keeps unlinked laboratory staff in account setup', async () => {
    laboratoryStaffRepository.findOne.mockResolvedValue(null);

    await expect(service.resolve(user([UserRole.LAB_STAFF]))).resolves.toEqual({
      routing_target: AuthRoutingTarget.ACCOUNT_SETUP,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: null,
    });
  });

  it('keeps an unlinked organization role in account setup', async () => {
    organizationAdminRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resolve(user([UserRole.HOSPITAL_ADMIN])),
    ).resolves.toEqual({
      routing_target: AuthRoutingTarget.ACCOUNT_SETUP,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: null,
    });
    expect(legacyLaboratoryAdminRepository.findOne).not.toHaveBeenCalled();
  });

  it('keeps ambiguous cross-family roles out of full access', async () => {
    await expect(
      service.resolve(user([UserRole.PATIENT, UserRole.DOCTOR])),
    ).resolves.toEqual({
      routing_target: AuthRoutingTarget.ACCOUNT_SETUP,
      access_level: AuthAccessLevel.LIMITED,
      verification_status: null,
    });
    expect(professionalRepository.findOne).not.toHaveBeenCalled();
  });
});
