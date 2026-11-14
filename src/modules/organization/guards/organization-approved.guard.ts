import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IRequestWithUser } from '../../../common/types';
import { AuthContextService } from '../../auth/context/auth-context.service';
import { OrganizationAdmin } from '../entities/organization-admin.entity';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

@Injectable()
export class OrganizationApprovedGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationAdmin)
    private readonly administratorRepository: Repository<OrganizationAdmin>,
    private readonly contexts: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IRequestWithUser>();
    const userId = request.user?.id ?? request.user?.userId;
    if (!userId) throw new UnauthorizedException('authentication is required');

    const administrator = await this.administratorRepository.findOne({
      where: { user_id: userId },
      relations: { organization: true },
    });
    if (!administrator?.organization) {
      throw new ForbiddenException(
        'organization administrator profile required',
      );
    }

    const accountContext = await this.contexts.resolve(
      userId,
      request.user.sessionId,
    );
    const membership = accountContext.memberships.find(
      (candidate) =>
        candidate.organization_id === administrator.organization.id,
    );
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('active organization membership required');
    }
    if (!administrator.organization.is_active) {
      throw new ForbiddenException('organization account is inactive');
    }
    if (
      administrator.organization.verification_status !==
      OrganizationVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException(
        'organization access is restricted until verification is approved',
      );
    }
    return true;
  }
}
