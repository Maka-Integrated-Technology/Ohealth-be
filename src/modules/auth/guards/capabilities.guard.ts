import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IRequestWithUser } from '../../../common/types';
import { AUTH_CAPABILITIES_KEY } from '../decorators/capabilities.decorator';
import { AuthCapability } from '../context/auth-capability';
import { AuthContextService } from '../context/auth-context.service';

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
    const accountContext = await this.contexts.assertCapabilities(
      user.id,
      user.sessionId,
      required,
    );
    (request as IRequestWithUser & { authContext?: unknown }).authContext =
      accountContext;
    return true;
  }
}
