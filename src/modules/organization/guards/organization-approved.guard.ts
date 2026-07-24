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
import { ORGANIZATION_ADMIN_ROLE } from '../constants/organization-role.constant';
import { OrganizationAdmin } from '../entities/organization-admin.entity';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

@Injectable()
export class OrganizationApprovedGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationAdmin)
    private readonly administratorRepository: Repository<OrganizationAdmin>,
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

    const requiredRole =
      ORGANIZATION_ADMIN_ROLE[administrator.organization.organization_type];
    if (!request.user.roles?.includes(requiredRole)) {
      throw new ForbiddenException(
        'authenticated role does not match the organization type',
      );
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
