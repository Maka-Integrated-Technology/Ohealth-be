import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import {
  OrganizationReviewListResponseDto,
  OrganizationReviewQueryDto,
  OrganizationStatusHistoryResponseDto,
  OrganizationStatusResponseDto,
  RejectOrganizationDto,
} from './dto/organization-verification.dto';
import { OrganizationAdmin } from './entities/organization-admin.entity';
import { OrganizationDocument } from './entities/organization-document.entity';
import { OrganizationStatusHistory } from './entities/organization-status-history.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationVerificationStatus } from './enums/organization-verification-status.enum';
import { OrganizationDocumentsService } from './organization-documents.service';

@Injectable()
export class OrganizationVerificationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationAdmin)
    private readonly administratorRepository: Repository<OrganizationAdmin>,
    @InjectRepository(OrganizationDocument)
    private readonly documentRepository: Repository<OrganizationDocument>,
    @InjectRepository(OrganizationStatusHistory)
    private readonly historyRepository: Repository<OrganizationStatusHistory>,
    private readonly documentsService: OrganizationDocumentsService,
    private readonly dataSource: DataSource,
  ) {}

  async getMine(userId: string): Promise<OrganizationStatusResponseDto> {
    return this.toStatus(await this.findForAdministratorOrThrow(userId));
  }

  async getForReview(
    organizationId: string,
  ): Promise<OrganizationStatusResponseDto> {
    return this.toStatus(await this.findOrganizationOrThrow(organizationId));
  }

  async submitMine(userId: string): Promise<OrganizationStatusResponseDto> {
    const organization = await this.findForAdministratorOrThrow(userId);
    return this.transition(
      organization.id,
      userId,
      OrganizationVerificationStatus.SUBMITTED,
      null,
      true,
    );
  }

  markUnderReview(
    organizationId: string,
    actorId: string,
  ): Promise<OrganizationStatusResponseDto> {
    return this.transition(
      organizationId,
      actorId,
      OrganizationVerificationStatus.UNDER_REVIEW,
      undefined,
      true,
    );
  }

  approve(
    organizationId: string,
    actorId: string,
  ): Promise<OrganizationStatusResponseDto> {
    return this.transition(
      organizationId,
      actorId,
      OrganizationVerificationStatus.APPROVED,
      null,
    );
  }

  reject(
    organizationId: string,
    actorId: string,
    dto: RejectOrganizationDto,
  ): Promise<OrganizationStatusResponseDto> {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('rejection reason is required');
    return this.transition(
      organizationId,
      actorId,
      OrganizationVerificationStatus.REJECTED,
      reason,
    );
  }

  async listApplications(
    query: OrganizationReviewQueryDto,
  ): Promise<OrganizationReviewListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: FindOptionsWhere<Organization> = {};
    if (query.organization_type) {
      where.organization_type = query.organization_type;
    }
    if (query.verification_status) {
      where.verification_status = query.verification_status;
    }

    const [applications, total] =
      await this.organizationRepository.findAndCount({
        where,
        order: { created_at: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      applications: applications.map((organization) => ({
        id: organization.id,
        organization_type: organization.organization_type,
        name: organization.name,
        registration_number: organization.registration_number,
        location: organization.location,
        contact_email: organization.contact_email,
        contact_phone: organization.contact_phone,
        verification_status: organization.verification_status,
        rejection_reason: organization.rejection_reason,
        is_active: organization.is_active,
        created_at: organization.created_at,
      })),
      total,
      page,
      limit,
    };
  }

  async listHistory(
    organizationId: string,
  ): Promise<OrganizationStatusHistoryResponseDto[]> {
    await this.findOrganizationOrThrow(organizationId);
    const history = await this.historyRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });
    return history.map((entry) => ({
      id: entry.id,
      organization_id: entry.organization_id,
      previous_status: entry.previous_status,
      new_status: entry.new_status,
      reason: entry.reason,
      changed_by_user_id: entry.changed_by_user_id,
      created_at: entry.created_at,
    }));
  }

  private transition(
    organizationId: string,
    actorId: string,
    nextStatus: OrganizationVerificationStatus,
    rejectionReason?: string | null,
    requireDocuments = false,
  ): Promise<OrganizationStatusResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const organizations = manager.withRepository(this.organizationRepository);
      const documents = manager.withRepository(this.documentRepository);
      const history = manager.withRepository(this.historyRepository);
      const organization = await organizations.findOne({
        where: { id: organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!organization) {
        throw new NotFoundException('organization not found');
      }
      this.assertTransition(organization.verification_status, nextStatus);

      if (requireDocuments) {
        this.documentsService.assertAllRequiredDocumentsPresent(
          organization,
          await documents.find({
            where: { organization_id: organization.id },
          }),
        );
      }

      const previousStatus = organization.verification_status;
      organization.verification_status = nextStatus;
      if (rejectionReason !== undefined) {
        organization.rejection_reason = rejectionReason;
      }
      const saved = await organizations.save(organization);
      await history.save(
        history.create({
          organization_id: organization.id,
          previous_status: previousStatus,
          new_status: nextStatus,
          reason: rejectionReason ?? null,
          changed_by_user_id: actorId,
        }),
      );
      return this.toStatus(saved);
    });
  }

  private assertTransition(
    current: OrganizationVerificationStatus,
    next: OrganizationVerificationStatus,
  ): void {
    const allowed: Record<
      OrganizationVerificationStatus,
      readonly OrganizationVerificationStatus[]
    > = {
      [OrganizationVerificationStatus.PENDING]: [
        OrganizationVerificationStatus.SUBMITTED,
      ],
      [OrganizationVerificationStatus.SUBMITTED]: [
        OrganizationVerificationStatus.UNDER_REVIEW,
      ],
      [OrganizationVerificationStatus.UNDER_REVIEW]: [
        OrganizationVerificationStatus.APPROVED,
        OrganizationVerificationStatus.REJECTED,
      ],
      [OrganizationVerificationStatus.APPROVED]: [],
      [OrganizationVerificationStatus.REJECTED]: [],
    };
    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(
        `organization verification cannot transition from ${current} to ${next}`,
      );
    }
  }

  private async findForAdministratorOrThrow(
    userId: string,
  ): Promise<Organization> {
    const administrator = await this.administratorRepository.findOne({
      where: { user_id: userId },
      relations: { organization: true },
    });
    if (!administrator?.organization) {
      throw new NotFoundException(
        'organization administrator profile not found',
      );
    }
    return administrator.organization;
  }

  private async findOrganizationOrThrow(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id },
    });
    if (!organization) throw new NotFoundException('organization not found');
    return organization;
  }

  private toStatus(organization: Organization): OrganizationStatusResponseDto {
    return {
      organization_id: organization.id,
      verification_status: organization.verification_status,
      rejection_reason: organization.rejection_reason,
      updated_at: organization.updated_at,
    };
  }
}
