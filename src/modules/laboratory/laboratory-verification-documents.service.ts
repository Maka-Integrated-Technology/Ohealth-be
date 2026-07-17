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
  LaboratoryVerificationDocumentDownloadDto,
  LaboratoryVerificationDocumentResponseDto,
  LaboratoryVerificationDocumentsStatusDto,
} from './dto/laboratory-verification-document-response.dto';
import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { Laboratory } from './entities/laboratory.entity';
import {
  LaboratoryVerificationDocumentType,
  REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES,
} from './enums/laboratory-verification-document-type.enum';
import { LaboratoryVerificationStatus } from './enums/laboratory-verification-status.enum';
import { LaboratoryVerificationDocumentFileValidator } from './laboratory-verification-document-file.validator';

const EDITABLE_VERIFICATION_STATUSES = [
  LaboratoryVerificationStatus.PENDING,
  LaboratoryVerificationStatus.SUBMITTED,
];

@Injectable()
export class LaboratoryVerificationDocumentsService {
  constructor(
    @InjectRepository(Laboratory)
    private readonly laboratoryRepository: Repository<Laboratory>,
    @InjectRepository(LaboratoryAdmin)
    private readonly laboratoryAdminRepository: Repository<LaboratoryAdmin>,
    @InjectRepository(LaboratoryVerificationDocument)
    private readonly documentRepository: Repository<LaboratoryVerificationDocument>,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly fileValidator: LaboratoryVerificationDocumentFileValidator,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({
      context: LaboratoryVerificationDocumentsService.name,
    });
  }

  private readonly logger: Logger;

  async uploadMyDocument(
    userId: string,
    documentType: LaboratoryVerificationDocumentType,
    file: IMulterFile,
  ): Promise<LaboratoryVerificationDocumentResponseDto> {
    const laboratory = await this.findLaboratoryForAdminOrThrow(userId);
    this.assertCanMutateDocuments(laboratory);
    this.assertValidDocumentType(documentType);
    const validatedFile = this.fileValidator.validate(file);

    const storageKey = this.buildStorageKey(
      laboratory.id,
      documentType,
      validatedFile.extension,
    );
    const uploaded = await this.storageService.uploadPrivateObject({
      key: storageKey,
      body: file.buffer,
      contentType: validatedFile.mimeType,
      metadata: {
        laboratory_id: laboratory.id,
        document_type: documentType,
        uploaded_by_user_id: userId,
      },
    });

    let persistenceResult: {
      savedDocument: LaboratoryVerificationDocument;
      replacedDocument: LaboratoryVerificationDocument | null;
    };
    try {
      persistenceResult = await this.persistUploadedDocument(
        laboratory.id,
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
  ): Promise<LaboratoryVerificationDocumentsStatusDto> {
    const laboratory = await this.findLaboratoryForAdminOrThrow(userId);

    return this.listDocumentsForLaboratory(laboratory.id);
  }

  async listDocumentsForLaboratory(
    laboratoryId: string,
  ): Promise<LaboratoryVerificationDocumentsStatusDto> {
    await this.findLaboratoryOrThrow(laboratoryId);
    const documents = await this.documentRepository.find({
      where: { laboratory_id: laboratoryId },
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
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<LaboratoryVerificationDocumentDownloadDto> {
    const laboratory = await this.findLaboratoryForAdminOrThrow(userId);
    const document = await this.findDocumentOrThrow(
      laboratory.id,
      documentType,
    );

    return this.createDocumentDownloadUrl(document);
  }

  async createAdminDocumentDownloadUrl(
    laboratoryId: string,
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<LaboratoryVerificationDocumentDownloadDto> {
    await this.findLaboratoryOrThrow(laboratoryId);
    const document = await this.findDocumentOrThrow(laboratoryId, documentType);

    return this.createDocumentDownloadUrl(document);
  }

  async deleteMyDocument(
    userId: string,
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<{ message: string }> {
    const laboratory = await this.findLaboratoryForAdminOrThrow(userId);
    this.assertCanMutateDocuments(laboratory);
    const document = await this.dataSource.transaction(async (manager) => {
      const laboratoryRepository = manager.withRepository(
        this.laboratoryRepository,
      );
      const documentRepository = manager.withRepository(
        this.documentRepository,
      );
      const lockedLaboratory = await laboratoryRepository.findOne({
        where: { id: laboratory.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedLaboratory) {
        throw new NotFoundException('laboratory not found');
      }

      this.assertCanMutateDocuments(lockedLaboratory);
      const storedDocument = await this.findDocumentWithRepositoryOrThrow(
        documentRepository,
        laboratory.id,
        documentType,
      );
      await documentRepository.remove(storedDocument);

      return storedDocument;
    });

    await this.deleteStoredObjectBestEffort(
      document.bucket,
      document.storage_key,
    );

    return { message: 'laboratory verification document deleted successfully' };
  }

  assertAllRequiredDocumentsPresent(
    documents: LaboratoryVerificationDocument[],
  ) {
    const missingDocumentTypes = this.getMissingDocumentTypes(documents);

    if (missingDocumentTypes.length) {
      throw new BadRequestException({
        message: 'all required laboratory verification documents are required',
        missing_document_types: missingDocumentTypes,
      });
    }
  }

  private async persistUploadedDocument(
    laboratoryId: string,
    userId: string,
    documentType: LaboratoryVerificationDocumentType,
    file: IMulterFile,
    uploaded: IStorageUploadResult,
  ): Promise<{
    savedDocument: LaboratoryVerificationDocument;
    replacedDocument: LaboratoryVerificationDocument | null;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const laboratoryRepository = manager.withRepository(
        this.laboratoryRepository,
      );
      const documentRepository = manager.withRepository(
        this.documentRepository,
      );
      const laboratory = await laboratoryRepository.findOne({
        where: { id: laboratoryId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!laboratory) {
        throw new NotFoundException('laboratory not found');
      }

      this.assertCanMutateDocuments(laboratory);
      const replacedDocument = await documentRepository.findOne({
        where: {
          laboratory_id: laboratoryId,
          document_type: documentType,
        },
      });
      const savedDocument = await documentRepository.save(
        documentRepository.create({
          id: replacedDocument?.id,
          laboratory_id: laboratoryId,
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

  private async findDocumentOrThrow(
    laboratoryId: string,
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<LaboratoryVerificationDocument> {
    return this.findDocumentWithRepositoryOrThrow(
      this.documentRepository,
      laboratoryId,
      documentType,
    );
  }

  private async findDocumentWithRepositoryOrThrow(
    documentRepository: Repository<LaboratoryVerificationDocument>,
    laboratoryId: string,
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<LaboratoryVerificationDocument> {
    this.assertValidDocumentType(documentType);
    const document = await documentRepository.findOne({
      where: {
        laboratory_id: laboratoryId,
        document_type: documentType,
      },
    });

    if (!document) {
      throw new NotFoundException('laboratory verification document not found');
    }

    return document;
  }

  private async createDocumentDownloadUrl(
    document: LaboratoryVerificationDocument,
  ): Promise<LaboratoryVerificationDocumentDownloadDto> {
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

  private assertCanMutateDocuments(laboratory: Laboratory): void {
    if (
      !EDITABLE_VERIFICATION_STATUSES.includes(laboratory.verification_status)
    ) {
      throw new ForbiddenException(
        'documents cannot be changed after verification review has started',
      );
    }
  }

  private assertValidDocumentType(
    documentType: LaboratoryVerificationDocumentType,
  ): void {
    if (!this.requiredDocumentTypes.includes(documentType)) {
      throw new BadRequestException('invalid laboratory document type');
    }
  }

  private buildStorageKey(
    laboratoryId: string,
    documentType: LaboratoryVerificationDocumentType,
    extension: string,
  ): string {
    return `laboratories/${laboratoryId}/verification-documents/${documentType}-${randomUUID()}${extension}`;
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
    documents: LaboratoryVerificationDocument[],
  ): LaboratoryVerificationDocumentType[] {
    const uploadedTypes = new Set(
      documents.map((document) => document.document_type),
    );

    return this.requiredDocumentTypes.filter(
      (type) => !uploadedTypes.has(type),
    );
  }

  private toDocumentDto(
    document: LaboratoryVerificationDocument,
  ): LaboratoryVerificationDocumentResponseDto {
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
      this.logger.warn('Failed to clean up laboratory verification document', {
        bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private get requiredDocumentTypes(): readonly LaboratoryVerificationDocumentType[] {
    return REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES;
  }
}
