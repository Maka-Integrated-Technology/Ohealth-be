import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IRequestWithUser } from '../../../common/types';
import { AuthCapability } from '../context/auth-capability';
import { AuthContextService } from '../context/auth-context.service';
import { AUTH_CAPABILITIES_KEY } from '../decorators/capabilities.decorator';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly contexts?: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AuthCapability[]>(
      AUTH_CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<IRequestWithUser>();
    const user = request.user;
    if (!user?.id || !user.sessionId) {
      throw new UnauthorizedException('authentication is required');
    }
    if (!this.contexts) {
      throw new UnauthorizedException('authorization context is unavailable');
    }
    const requiresOrganization = required.some((capability) =>
      capability.startsWith('organization.'),
    );
    const organizationHeader = request.headers['x-organization-id'];
    const activeOrganizationId = Array.isArray(organizationHeader)
      ? organizationHeader[0]
      : organizationHeader;
    if (requiresOrganization && !activeOrganizationId) {
      throw new ForbiddenException('active organization is required');
    }
    const accountContext = await this.contexts.assertCapabilities(
      user.id,
      user.sessionId,
      required,
      activeOrganizationId,
    );
    (request as IRequestWithUser & { authContext?: unknown }).authContext =
      accountContext;
    return true;
  }
}
