import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { IRequestWithUser } from '../../../common/types';
import { AuthContextService } from '../../auth/context/auth-context.service';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

@Injectable()
export class OrganizationApprovedGuard implements CanActivate {
  constructor(private readonly contexts: AuthContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IRequestWithUser>();
    const userId = request.user?.id ?? request.user?.userId;
    if (!userId) throw new UnauthorizedException('authentication is required');

    const organizationId = request.headers['x-organization-id'];
    if (typeof organizationId !== 'string' || !organizationId) {
      throw new ForbiddenException('active organization is required');
    }

    const accountContext = await this.contexts.resolve(
      userId,
      request.user.sessionId,
      organizationId,
    );
    const membership = accountContext.memberships.find(
      (candidate) => candidate.organization_id === organizationId,
    );
    if (
      !membership ||
      !['owner', 'admin'].includes(membership.role) ||
      !membership.organization_is_active
    ) {
      throw new ForbiddenException('active organization membership required');
    }
    if (
      membership.organization_verification_status !==
      OrganizationVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException(
        'organization access is restricted until verification is approved',
      );
    }
    return true;
  }
}
