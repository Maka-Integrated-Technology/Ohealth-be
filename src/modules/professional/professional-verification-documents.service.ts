import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import { IMulterFile } from '../../common/types';
import { IStorageUploadResult } from '../storage/interfaces/storage.interface';
import { StorageService } from '../storage/storage.service';

import {
  ProfessionalVerificationDocumentDownloadDto,
  ProfessionalVerificationDocumentResponseDto,
  ProfessionalVerificationDocumentsStatusDto,
} from './dto/professional-verification-document-response.dto';
import { ProfessionalVerificationDocument } from './entities/professional-verification-document.entity';
import {
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';
import {
  ProfessionalVerificationDocumentType,
  REQUIRED_PROFESSIONAL_VERIFICATION_DOCUMENT_TYPES,
} from './enums/professional-verification-document-type.enum';
import { ProfessionalVerificationDocumentFileValidator } from './professional-verification-document-file.validator';

const EDITABLE_VERIFICATION_STATUSES = [ProfessionalVerificationStatus.PENDING];

@Injectable()
export class ProfessionalVerificationDocumentsService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalVerificationDocument)
    private readonly documentRepository: Repository<ProfessionalVerificationDocument>,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly fileValidator: ProfessionalVerificationDocumentFileValidator,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({
      context: ProfessionalVerificationDocumentsService.name,
    });
  }

  private readonly logger: Logger;

  async uploadMyDocument(
    userId: string,
    documentType: ProfessionalVerificationDocumentType,
    file: IMulterFile,
  ): Promise<ProfessionalVerificationDocumentResponseDto> {
    const professional = await this.findProfessionalForUserOrThrow(userId);
    this.assertCanMutateDocuments(professional);
    this.assertValidDocumentType(documentType);
    const validatedFile = this.fileValidator.validate(file);

    const storageKey = this.buildStorageKey(
      professional.id,
      documentType,
      validatedFile.extension,
    );
    const uploaded = await this.storageService.uploadPrivateObject({
      key: storageKey,
      body: file.buffer,
      contentType: validatedFile.mimeType,
      metadata: {
        professional_id: professional.id,
        document_type: documentType,
        uploaded_by_user_id: userId,
      },
    });

    let persistenceResult: {
      savedDocument: ProfessionalVerificationDocument;
      replacedDocument: ProfessionalVerificationDocument | null;
    };
    try {
      persistenceResult = await this.persistUploadedDocument(
        professional.id,
        userId,
        documentType,
        file,
        uploaded,
      );
    } catch (error) {
      await this.deleteStoredObjectBestEffort(uploaded.bucket, uploaded.key);
      throw error;
    }

    if (persistenceResult.replacedDocument?.storage_key) {
      await this.deleteStoredObjectBestEffort(
        persistenceResult.replacedDocument.bucket,
        persistenceResult.replacedDocument.storage_key,
      );
    }

    return this.toDocumentDto(persistenceResult.savedDocument);
  }

  async listMyDocuments(
    userId: string,
  ): Promise<ProfessionalVerificationDocumentsStatusDto> {
    const professional = await this.findProfessionalForUserOrThrow(userId);

    return this.listDocumentsForProfessional(professional.id);
  }

  async listDocumentsForProfessional(
    professionalId: string,
  ): Promise<ProfessionalVerificationDocumentsStatusDto> {
    await this.findProfessionalOrThrow(professionalId);
    const documents = await this.documentRepository.find({
      where: { professional_id: professionalId },
      order: { document_type: 'ASC' },
    });

    const missingDocumentTypes = this.getMissingDocumentTypes(documents);

    return {
      documents: documents.map((document) => this.toDocumentDto(document)),
      missing_document_types: missingDocumentTypes,
      is_complete: missingDocumentTypes.length === 0,
    };
  }

  async createMyDocumentDownloadUrl(
    userId: string,
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<ProfessionalVerificationDocumentDownloadDto> {
    const professional = await this.findProfessionalForUserOrThrow(userId);
    const document = await this.findDocumentOrThrow(
      professional.id,
      documentType,
    );

    return this.createDocumentDownloadUrl(document);
  }

  async createAdminDocumentDownloadUrl(
    professionalId: string,
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<ProfessionalVerificationDocumentDownloadDto> {
    await this.findProfessionalOrThrow(professionalId);
    const document = await this.findDocumentOrThrow(
      professionalId,
      documentType,
    );

    return this.createDocumentDownloadUrl(document);
  }

  async deleteMyDocument(
    userId: string,
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<{ message: string }> {
    const professional = await this.findProfessionalForUserOrThrow(userId);
    this.assertCanMutateDocuments(professional);
    const document = await this.dataSource.transaction(async (manager) => {
      const professionalRepository = manager.withRepository(
        this.professionalRepository,
      );
      const documentRepository = manager.withRepository(
        this.documentRepository,
      );
      const lockedProfessional = await professionalRepository.findOne({
        where: { id: professional.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedProfessional) {
        throw new NotFoundException('professional not found');
      }

      this.assertCanMutateDocuments(lockedProfessional);
      const storedDocument = await this.findDocumentWithRepositoryOrThrow(
        documentRepository,
        professional.id,
        documentType,
      );
      await documentRepository.remove(storedDocument);

      return storedDocument;
    });

    await this.deleteStoredObjectBestEffort(
      document.bucket,
      document.storage_key,
    );

    return {
      message: 'professional verification document deleted successfully',
    };
  }

  assertAllRequiredDocumentsPresent(
    documents: ProfessionalVerificationDocument[],
  ) {
    const missingDocumentTypes = this.getMissingDocumentTypes(documents);

    if (missingDocumentTypes.length) {
      throw new BadRequestException({
        message:
          'all required professional verification documents are required',
        missing_document_types: missingDocumentTypes,
      });
    }
  }

  private async persistUploadedDocument(
    professionalId: string,
    userId: string,
    documentType: ProfessionalVerificationDocumentType,
    file: IMulterFile,
    uploaded: IStorageUploadResult,
  ): Promise<{
    savedDocument: ProfessionalVerificationDocument;
    replacedDocument: ProfessionalVerificationDocument | null;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const professionalRepository = manager.withRepository(
        this.professionalRepository,
      );
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

      this.assertCanMutateDocuments(professional);
      const replacedDocument = await documentRepository.findOne({
        where: {
          professional_id: professionalId,
          document_type: documentType,
        },
      });
      const savedDocument = await documentRepository.save(
        documentRepository.create({
          id: replacedDocument?.id,
          professional_id: professionalId,
          document_type: documentType,
          bucket: uploaded.bucket,
          storage_key: uploaded.key,
          original_filename: this.normalizeFilename(file.originalname),
          mime_type: uploaded.contentType,
          file_size: uploaded.size,
          uploaded_by_user_id: userId,
        }),
      );

      return { savedDocument, replacedDocument };
    });
  }

  private async findProfessionalForUserOrThrow(
    userId: string,
  ): Promise<Professional> {
    const professional = await this.professionalRepository.findOne({
      where: { user_id: userId },
    });

    if (!professional) {
      throw new NotFoundException('professional profile not found');
    }

    return professional;
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

  private async findDocumentOrThrow(
    professionalId: string,
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<ProfessionalVerificationDocument> {
    return this.findDocumentWithRepositoryOrThrow(
      this.documentRepository,
      professionalId,
      documentType,
    );
  }

  private async findDocumentWithRepositoryOrThrow(
    documentRepository: Repository<ProfessionalVerificationDocument>,
    professionalId: string,
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<ProfessionalVerificationDocument> {
    this.assertValidDocumentType(documentType);
    const document = await documentRepository.findOne({
      where: {
        professional_id: professionalId,
        document_type: documentType,
      },
    });

    if (!document) {
      throw new NotFoundException(
        'professional verification document not found',
      );
    }

    return document;
  }

  private async createDocumentDownloadUrl(
    document: ProfessionalVerificationDocument,
  ): Promise<ProfessionalVerificationDocumentDownloadDto> {
    const expiresInSeconds =
      this.configService.get<number>('storage.aws.s3.signedUrlTtlSeconds') ||
      300;
    const url = await this.storageService.createSignedGetUrl({
      bucket: document.bucket,
      key: document.storage_key,
      expiresInSeconds,
      responseContentDisposition: `attachment; filename="${this.sanitizeDownloadFilename(document.original_filename)}"`,
    });

    return {
      url,
      expires_in_seconds: expiresInSeconds,
    };
  }

  private assertCanMutateDocuments(professional: Professional): void {
    if (
      !EDITABLE_VERIFICATION_STATUSES.includes(professional.verification_status)
    ) {
      throw new ForbiddenException(
        'documents cannot be changed after verification review has started',
      );
    }
  }

  private assertValidDocumentType(
    documentType: ProfessionalVerificationDocumentType,
  ): void {
    if (!this.requiredDocumentTypes.includes(documentType)) {
      throw new BadRequestException('invalid professional document type');
    }
  }

  private buildStorageKey(
    professionalId: string,
    documentType: ProfessionalVerificationDocumentType,
    extension: string,
  ): string {
    return `professionals/${professionalId}/verification-documents/${documentType}-${randomUUID()}${extension}`;
  }

  private normalizeFilename(filename?: string): string {
    return path.basename(filename?.trim() || 'document');
  }

  private sanitizeDownloadFilename(filename: string): string {
    return this.normalizeFilename(filename).replace(
      /[\u0000-\u001f\u007f"\\]/g,
      '_',
    );
  }

  private getMissingDocumentTypes(
    documents: ProfessionalVerificationDocument[],
  ): ProfessionalVerificationDocumentType[] {
    const uploadedTypes = new Set(
      documents.map((document) => document.document_type),
    );

    return this.requiredDocumentTypes.filter(
      (type) => !uploadedTypes.has(type),
    );
  }

  private toDocumentDto(
    document: ProfessionalVerificationDocument,
  ): ProfessionalVerificationDocumentResponseDto {
    return {
      id: document.id,
      document_type: document.document_type,
      original_filename: document.original_filename,
      mime_type: document.mime_type,
      file_size: document.file_size,
      created_at: document.created_at,
      updated_at: document.updated_at,
    };
  }

  private async deleteStoredObjectBestEffort(
    bucket: string,
    key: string,
  ): Promise<void> {
    try {
      await this.storageService.deleteObject({
        bucket,
        key,
      });
    } catch (error) {
      this.logger.warn(
        'Failed to clean up professional verification document',
        {
          bucket,
          key,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private get requiredDocumentTypes(): readonly ProfessionalVerificationDocumentType[] {
    return REQUIRED_PROFESSIONAL_VERIFICATION_DOCUMENT_TYPES;
  }
}
