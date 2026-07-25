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
import { LaboratoryAdmin } from '../entities/laboratory-admin.entity';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

@Injectable()
export class LaboratoryApprovedGuard implements CanActivate {
  constructor(
    @InjectRepository(LaboratoryAdmin)
    private readonly laboratoryAdminRepository: Repository<LaboratoryAdmin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IRequestWithUser>();
    const userId = request.user?.id ?? request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('authentication is required');
    }

    const administrator = await this.laboratoryAdminRepository.findOne({
      where: { user_id: userId },
      relations: ['laboratory'],
    });

    if (!administrator?.laboratory) {
      throw new ForbiddenException('laboratory administrator profile required');
    }

    if (
      administrator.laboratory.verification_status !==
      LaboratoryVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException(
        'laboratory account access is restricted until verification is approved',
      );
    }

    return true;
  }
}
