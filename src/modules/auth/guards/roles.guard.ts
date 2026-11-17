import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../user/enums/user-role.enum';
import { AuthCapability } from '../context/auth-capability';
import { AuthContextService } from '../context/auth-context.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Optional() private readonly contexts?: AuthContextService,
    @Optional() private readonly audit?: AuthSecurityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    if (!this.audit) return false;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.id || !user.sessionId) {
      await this.recordDenial();
      return false;
    }

    const capabilities = requiredRoles.flatMap((role) => {
      if (role === UserRole.PATIENT) return [AuthCapability.PERSONA_PATIENT];
      if (
        [
          UserRole.DOCTOR,
          UserRole.THERAPIST,
          UserRole.COUNSELLOR,
          UserRole.LAB_PROFESSIONAL,
        ].includes(role)
      ) {
        return [AuthCapability.PERSONA_PROFESSIONAL];
      }
      if (
        [
          UserRole.LAB_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.PHARMACY_ADMIN,
        ].includes(role)
      ) {
        return [AuthCapability.ORGANIZATION_ADMIN];
      }
      if (role === UserRole.LAB_STAFF) {
        return [AuthCapability.ORGANIZATION_MEMBER];
      }
      if (role === UserRole.ADMIN) return [AuthCapability.PLATFORM_ADMIN];
      return [];
    });
    if (!capabilities.length || !this.contexts) {
      await this.recordDenial(user.id, user.sessionId);
      return false;
    }
    let accountContext;
    try {
      accountContext = await this.contexts.resolve(user.id, user.sessionId);
    } catch {
      await this.recordDenial(user.id, user.sessionId);
      return false;
    }
    const allowed = capabilities.some((capability) =>
      accountContext.capabilities.includes(capability),
    );
    if (!allowed) await this.recordDenial(user.id, user.sessionId);
    return allowed;
  }

  private async recordDenial(
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.audit!.recordAttempt({
      event_type: AuthSecurityEventType.AUTHORIZATION_DENIAL,
      outcome: AuthSecurityEventOutcome.DENIED,
      actor_user_id: userId,
      subject_user_id: userId,
      session_id: sessionId,
    });
  }
}
