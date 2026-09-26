import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  ProfessionalVerificationStatusHistoryResponseDto,
  ProfessionalVerificationStatusResponseDto,
} from './dto/professional-verification-status-response.dto';
import { ProfessionalVerificationDocument } from './entities/professional-verification-document.entity';
import { ProfessionalVerificationStatusHistory } from './entities/professional-verification-status-history.entity';
import {
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';
import { REQUIRED_PROFESSIONAL_VERIFICATION_DOCUMENT_TYPES } from './enums/professional-verification-document-type.enum';

@Injectable()
export class ProfessionalVerificationStatusService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalVerificationDocument)
    private readonly documentRepository: Repository<ProfessionalVerificationDocument>,
    @InjectRepository(ProfessionalVerificationStatusHistory)
    private readonly historyRepository: Repository<ProfessionalVerificationStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async getStatus(
    professionalId: string,
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    const professional = await this.findProfessionalOrThrow(professionalId);
    const documentsComplete = await this.documentsComplete(professionalId);

    return {
      professional_id: professional.id,
      verification_status: professional.verification_status,
      documents_complete: documentsComplete,
    };
  }

  async getMyStatus(
    userId: string,
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    const professional = await this.professionalRepository.findOne({
      where: { user_id: userId },
    });

    if (!professional) {
      throw new NotFoundException('professional profile not found');
    }

    return this.getStatus(professional.id);
  }

  async verify(
    professionalId: string,
    actorUserId: string,
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    return this.transitionStatus({
      professionalId,
      actorUserId,
      nextStatus: ProfessionalVerificationStatus.VERIFIED,
      reason: null,
      requireCompleteDocuments: true,
    });
  }

  async reject(
    professionalId: string,
    actorUserId: string,
    reason: string,
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('rejection reason is required');
    }

    return this.transitionStatus({
      professionalId,
      actorUserId,
      nextStatus: ProfessionalVerificationStatus.REJECTED,
      reason: trimmedReason,
      requireCompleteDocuments: false,
    });
  }

  async listHistory(
    professionalId: string,
  ): Promise<ProfessionalVerificationStatusHistoryResponseDto[]> {
    await this.findProfessionalOrThrow(professionalId);
    const history = await this.historyRepository.find({
      where: { professional_id: professionalId },
      order: { created_at: 'DESC' },
    });

    return history.map((entry) => this.toHistoryDto(entry));
  }

  private async transitionStatus(options: {
    professionalId: string;
    actorUserId: string;
    nextStatus: ProfessionalVerificationStatus;
    reason: string | null;
    requireCompleteDocuments: boolean;
  }): Promise<ProfessionalVerificationStatusResponseDto> {
    const { professionalId, actorUserId, nextStatus, reason } = options;

    return this.dataSource.transaction(async (manager) => {
      const professionalRepository = manager.withRepository(
        this.professionalRepository,
      );
      const historyRepository = manager.withRepository(this.historyRepository);
      const documentRepository = manager.withRepository(
        this.documentRepository,
      );

      const professional = await professionalRepository.findOne({
        where: { id: professionalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!professional) {
        throw new NotFoundException('professional not found');
      }

      if (options.requireCompleteDocuments) {
        const documents = await documentRepository.find({
          where: { professional_id: professionalId },
        });
        const uploadedTypes = new Set(
          documents.map((document) => document.document_type),
        );
        const missing =
          REQUIRED_PROFESSIONAL_VERIFICATION_DOCUMENT_TYPES.filter(
            (type) => !uploadedTypes.has(type),
          );
        if (missing.length) {
          throw new BadRequestException({
            message:
              'all required professional verification documents are required',
            missing_document_types: missing,
          });
        }
      }

      const previousStatus = professional.verification_status;
      professional.verification_status = nextStatus;
      await professionalRepository.save(professional);

      await historyRepository.save(
        historyRepository.create({
          professional_id: professionalId,
          previous_status: previousStatus,
          new_status: nextStatus,
          reason,
          changed_by_user_id: actorUserId,
        }),
      );

      return {
        professional_id: professional.id,
        verification_status: professional.verification_status,
        documents_complete: options.requireCompleteDocuments
          ? true
          : await this.documentsCompleteWithRepository(
              documentRepository,
              professionalId,
            ),
      };
    });
  }

  private async documentsComplete(professionalId: string): Promise<boolean> {
    return this.documentsCompleteWithRepository(
      this.documentRepository,
      professionalId,
    );
  }

  private async documentsCompleteWithRepository(
    documentRepository: Repository<ProfessionalVerificationDocument>,
    professionalId: string,
  ): Promise<boolean> {
    const documents = await documentRepository.find({
      where: { professional_id: professionalId },
    });
    const uploadedTypes = new Set(
      documents.map((document) => document.document_type),
    );

    return REQUIRED_PROFESSIONAL_VERIFICATION_DOCUMENT_TYPES.every((type) =>
      uploadedTypes.has(type),
    );
  }

  private async findProfessionalOrThrow(
    professionalId: string,
  ): Promise<Professional> {
    const professional = await this.professionalRepository.findOne({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new NotFoundException('professional not found');
    }

    return professional;
  }

  private toHistoryDto(
    entry: ProfessionalVerificationStatusHistory,
  ): ProfessionalVerificationStatusHistoryResponseDto {
    return {
      id: entry.id,
      previous_status: entry.previous_status,
      new_status: entry.new_status,
      reason: entry.reason,
      changed_by_user_id: entry.changed_by_user_id,
      created_at: entry.created_at,
    };
  }
}
