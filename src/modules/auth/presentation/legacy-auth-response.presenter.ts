import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { ProfessionalVerificationStatus } from '../../professional/entities/professional.entity';
import { UserRole } from '../../user/enums/user-role.enum';
import { AuthCapability } from '../context/auth-capability';
import { IAuthAccountContext } from '../context/auth-context.types';
import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

const verificationTargets = {
  [OrganizationType.HOSPITAL]: AuthRoutingTarget.HOSPITAL_VERIFICATION,
  [OrganizationType.LABORATORY]: AuthRoutingTarget.LABORATORY_VERIFICATION,
  [OrganizationType.PHARMACY]: AuthRoutingTarget.PHARMACY_VERIFICATION,
};
const dashboardTargets = {
  [OrganizationType.HOSPITAL]: AuthRoutingTarget.HOSPITAL_DASHBOARD,
  [OrganizationType.LABORATORY]: AuthRoutingTarget.LABORATORY_DASHBOARD,
  [OrganizationType.PHARMACY]: AuthRoutingTarget.PHARMACY_DASHBOARD,
};

/** Deprecated response compatibility only. Authorization always uses capabilities. */
export function presentLegacyAuthResponse(context: IAuthAccountContext) {
  const memberships = context.memberships ?? [];
  const personas = context.personas ?? [];
  const capabilities = context.capabilities ?? [];
  const membership = context.active_organization_id
    ? memberships.find(
        (item) => item.organization_id === context.active_organization_id,
      )
    : memberships[0];
  let routingTarget = AuthRoutingTarget.ACCOUNT_SETUP;
  let verificationStatus: string | null = null;

  if (capabilities.includes(AuthCapability.PLATFORM_ADMIN)) {
    routingTarget = AuthRoutingTarget.ADMIN_DASHBOARD;
  } else if (context.professional) {
    verificationStatus = context.professional.verification_status;
    routingTarget =
      context.professional.verification_status ===
        ProfessionalVerificationStatus.VERIFIED &&
      context.professional.is_active
        ? AuthRoutingTarget.PROFESSIONAL_DASHBOARD
        : AuthRoutingTarget.PROFESSIONAL_VERIFICATION;
  } else if (membership) {
    verificationStatus = membership.organization_verification_status;
    routingTarget =
      membership.organization_verification_status ===
        OrganizationVerificationStatus.APPROVED &&
      membership.organization_is_active
        ? dashboardTargets[membership.organization_type]
        : verificationTargets[membership.organization_type];
  } else if (
    personas.some((persona) => persona.type === UserPersonaType.PATIENT)
  ) {
    routingTarget = AuthRoutingTarget.PATIENT_HOME;
  }

  const fullTargets = new Set([
    AuthRoutingTarget.ADMIN_DASHBOARD,
    AuthRoutingTarget.PATIENT_HOME,
    AuthRoutingTarget.PROFESSIONAL_DASHBOARD,
    AuthRoutingTarget.HOSPITAL_DASHBOARD,
    AuthRoutingTarget.LABORATORY_DASHBOARD,
    AuthRoutingTarget.PHARMACY_DASHBOARD,
  ]);
  const roles: UserRole[] = [];
  if (capabilities.includes(AuthCapability.PLATFORM_ADMIN))
    roles.push(UserRole.ADMIN);
  if (personas.some((persona) => persona.type === UserPersonaType.PATIENT))
    roles.push(UserRole.PATIENT);

  return {
    user: {
      id: context.account.id,
      email: context.account.email,
      first_name: context.account.first_name,
      last_name: context.account.last_name,
      role: roles,
    },
    routing_target: routingTarget,
    access_level: fullTargets.has(routingTarget)
      ? AuthAccessLevel.FULL
      : AuthAccessLevel.LIMITED,
    verification_status: verificationStatus,
  };
}
