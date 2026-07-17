import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  LaboratoryVerificationStatusHistoryResponseDto,
  LaboratoryVerificationStatusResponseDto,
  RejectLaboratoryVerificationDto,
} from './dto/laboratory-verification-status.dto';
import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { LaboratoryVerificationStatusHistory } from './entities/laboratory-verification-status-history.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryOnboardingStatus } from './enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from './enums/laboratory-verification-status.enum';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';

@Injectable()
export class LaboratoryVerificationStatusService {
  constructor(
    @InjectRepository(Laboratory)
    private readonly laboratoryRepository: Repository<Laboratory>,
    @InjectRepository(LaboratoryAdmin)
    private readonly laboratoryAdminRepository: Repository<LaboratoryAdmin>,
    @InjectRepository(LaboratoryVerificationDocument)
    private readonly documentRepository: Repository<LaboratoryVerificationDocument>,
    @InjectRepository(LaboratoryVerificationStatusHistory)
    private readonly historyRepository: Repository<LaboratoryVerificationStatusHistory>,
    private readonly verificationDocumentsService: LaboratoryVerificationDocumentsService,
    private readonly dataSource: DataSource,
  ) {}

  async getMyStatus(
    userId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    const laboratory = await this.findLaboratoryForAdminOrThrow(userId);

    return this.toStatusDto(laboratory);
  }

  async getStatusForLaboratory(
    laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    const laboratory = await this.findLaboratoryOrThrow(laboratoryId);

    return this.toStatusDto(laboratory);
  }

  async submitMyVerification(
    userId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    const laboratory = await this.findLaboratoryForAdminOrThrow(userId);

    return this.transitionLaboratoryStatus({
      laboratoryId: laboratory.id,
      actorUserId: userId,
      nextStatus: LaboratoryVerificationStatus.SUBMITTED,
      onboardingStatus: LaboratoryOnboardingStatus.VERIFICATION_SUBMITTED,
      rejectionReason: null,
      requireCompleteDocuments: true,
    });
  }

  async markUnderReview(
    laboratoryId: string,
    actorUserId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.transitionLaboratoryStatus({
      laboratoryId,
      actorUserId,
      nextStatus: LaboratoryVerificationStatus.UNDER_REVIEW,
      requireCompleteDocuments: true,
    });
  }

  async approve(
    laboratoryId: string,
    actorUserId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.transitionLaboratoryStatus({
      laboratoryId,
      actorUserId,
      nextStatus: LaboratoryVerificationStatus.APPROVED,
      onboardingStatus: LaboratoryOnboardingStatus.VERIFIED,
      rejectionReason: null,
    });
  }

  async reject(
    laboratoryId: string,
    actorUserId: string,
    dto: RejectLaboratoryVerificationDto,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    const reason = dto?.reason?.trim();
    if (!reason) {
      throw new BadRequestException('rejection reason is required');
    }

    return this.transitionLaboratoryStatus({
      laboratoryId,
      actorUserId,
      nextStatus: LaboratoryVerificationStatus.REJECTED,
      rejectionReason: reason,
    });
  }

  async listHistory(
    laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusHistoryResponseDto[]> {
    await this.findLaboratoryOrThrow(laboratoryId);
    const history = await this.historyRepository.find({
      where: { laboratory_id: laboratoryId },
      order: { created_at: 'DESC' },
    });

    return history.map((entry) => this.toHistoryDto(entry));
  }

  private async transitionLaboratoryStatus(options: {
    laboratoryId: string;
    actorUserId: string;
    nextStatus: LaboratoryVerificationStatus;
    onboardingStatus?: LaboratoryOnboardingStatus;
    rejectionReason?: string | null;
    requireCompleteDocuments?: boolean;
  }): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const laboratoryRepository = manager.withRepository(
        this.laboratoryRepository,
      );
      const documentRepository = manager.withRepository(
        this.documentRepository,
      );
      const historyRepository = manager.withRepository(this.historyRepository);
      const laboratory = await laboratoryRepository.findOne({
        where: { id: options.laboratoryId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!laboratory) {
        throw new NotFoundException('laboratory not found');
      }

      this.assertTransitionAllowed(
        laboratory.verification_status,
        options.nextStatus,
      );

      if (options.requireCompleteDocuments) {
        const documents = await documentRepository.find({
          where: { laboratory_id: laboratory.id },
        });
        this.verificationDocumentsService.assertAllRequiredDocumentsPresent(
          documents,
        );
      }

      const previousStatus = laboratory.verification_status;
      laboratory.verification_status = options.nextStatus;
      if (options.onboardingStatus) {
        laboratory.onboarding_status = options.onboardingStatus;
      }
      if (options.rejectionReason !== undefined) {
        laboratory.verification_rejection_reason = options.rejectionReason;
      }

      const savedLaboratory = await laboratoryRepository.save(laboratory);
      await historyRepository.save(
        historyRepository.create({
          laboratory_id: savedLaboratory.id,
          previous_status: previousStatus,
          new_status: options.nextStatus,
          reason: options.rejectionReason ?? null,
          changed_by_user_id: options.actorUserId,
        }),
      );

      return this.toStatusDto(savedLaboratory);
    });
  }

  private assertTransitionAllowed(
    currentStatus: LaboratoryVerificationStatus,
    nextStatus: LaboratoryVerificationStatus,
  ): void {
    const allowedNextStatuses: Record<
      LaboratoryVerificationStatus,
      LaboratoryVerificationStatus[]
    > = {
      [LaboratoryVerificationStatus.PENDING]: [
        LaboratoryVerificationStatus.SUBMITTED,
      ],
      [LaboratoryVerificationStatus.SUBMITTED]: [
        LaboratoryVerificationStatus.UNDER_REVIEW,
      ],
      [LaboratoryVerificationStatus.UNDER_REVIEW]: [
        LaboratoryVerificationStatus.APPROVED,
        LaboratoryVerificationStatus.REJECTED,
      ],
      [LaboratoryVerificationStatus.APPROVED]: [],
      [LaboratoryVerificationStatus.REJECTED]: [],
    };

    if (!allowedNextStatuses[currentStatus]?.includes(nextStatus)) {
      throw new BadRequestException(
        `laboratory verification cannot transition from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private async findLaboratoryForAdminOrThrow(
    userId: string,
  ): Promise<Laboratory> {
    const administrator = await this.laboratoryAdminRepository.findOne({
      where: { user_id: userId },
      relations: ['laboratory'],
    });

    if (!administrator?.laboratory) {
      throw new NotFoundException('laboratory administrator profile not found');
    }

    return administrator.laboratory;
  }

  private async findLaboratoryOrThrow(
    laboratoryId: string,
  ): Promise<Laboratory> {
    const laboratory = await this.laboratoryRepository.findOne({
      where: { id: laboratoryId },
    });

    if (!laboratory) {
      throw new NotFoundException('laboratory not found');
    }

    return laboratory;
  }

  private toStatusDto(
    laboratory: Laboratory,
  ): LaboratoryVerificationStatusResponseDto {
    return {
      laboratory_id: laboratory.id,
      verification_status: laboratory.verification_status,
      onboarding_status: laboratory.onboarding_status,
      verification_rejection_reason:
        laboratory.verification_rejection_reason ?? null,
      updated_at: laboratory.updated_at,
    };
  }

  private toHistoryDto(
    entry: LaboratoryVerificationStatusHistory,
  ): LaboratoryVerificationStatusHistoryResponseDto {
    return {
      id: entry.id,
      laboratory_id: entry.laboratory_id,
      previous_status: entry.previous_status,
      new_status: entry.new_status,
      reason: entry.reason,
      changed_by_user_id: entry.changed_by_user_id,
      created_at: entry.created_at,
    };
  }
}
