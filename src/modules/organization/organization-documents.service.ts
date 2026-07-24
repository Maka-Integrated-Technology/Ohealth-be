import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import { IMulterFile } from '../../common/types';
import { VerificationDocumentFileValidator } from '../../common/validators/verification-document-file.validator';
import { IStorageUploadResult } from '../storage/interfaces/storage.interface';
import { StorageService } from '../storage/storage.service';

import {
  OrganizationDocumentChecklistDto,
  OrganizationDocumentDownloadDto,
  OrganizationDocumentResponseDto,
} from './dto/organization-verification.dto';
import { OrganizationAdmin } from './entities/organization-admin.entity';
import { OrganizationDocument } from './entities/organization-document.entity';
import { Organization } from './entities/organization.entity';
import {
  OrganizationDocumentType,
  REQUIRED_ORGANIZATION_DOCUMENT_TYPES,
} from './enums/organization-document-type.enum';
import { OrganizationVerificationStatus } from './enums/organization-verification-status.enum';

const EDITABLE_STATUSES = new Set([
  OrganizationVerificationStatus.PENDING,
  OrganizationVerificationStatus.SUBMITTED,
]);
const DOWNLOAD_TTL_SECONDS = 300;

@Injectable()
export class OrganizationDocumentsService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationAdmin)
    private readonly administratorRepository: Repository<OrganizationAdmin>,
    @InjectRepository(OrganizationDocument)
    private readonly documentRepository: Repository<OrganizationDocument>,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly fileValidator: VerificationDocumentFileValidator,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({
      context: OrganizationDocumentsService.name,
    });
  }

  async uploadMine(
    userId: string,
    documentType: OrganizationDocumentType,
    file?: IMulterFile,
  ): Promise<OrganizationDocumentResponseDto> {
    const organization = await this.findForAdministratorOrThrow(userId);
    this.assertDocumentTypeAllowed(organization, documentType);
    this.assertDocumentsEditable(organization);
    const validated = this.fileValidator.validate(file);
    const storageKey = [
      'organizations',
      organization.id,
      'onboarding',
      documentType,
      `${randomUUID()}${validated.extension}`,
    ].join('/');
    const uploaded = await this.storageService.uploadPrivateObject({
      key: storageKey,
      body: file!.buffer,
      contentType: validated.mimeType,
      metadata: {
        organization_id: organization.id,
        document_type: documentType,
        uploaded_by_user_id: userId,
      },
    });

    let persisted: {
      saved: OrganizationDocument;
      replaced: OrganizationDocument | null;
    };
    try {
      persisted = await this.persistUpload(
        organization.id,
        userId,
        documentType,
        file!,
        uploaded,
      );
    } catch (error) {
      await this.deleteStoredObjectBestEffort(uploaded.bucket, uploaded.key);
      throw error;
    }

    if (persisted.replaced) {
      await this.deleteStoredObjectBestEffort(
        persisted.replaced.bucket,
        persisted.replaced.storage_key,
      );
    }
    return this.toDto(persisted.saved);
  }

  async listMine(userId: string): Promise<OrganizationDocumentChecklistDto> {
    const organization = await this.findForAdministratorOrThrow(userId);
    return this.buildChecklist(
      organization,
      await this.findAll(organization.id),
    );
  }

  async listForReview(
    organizationId: string,
  ): Promise<OrganizationDocumentChecklistDto> {
    const organization = await this.findOrganizationOrThrow(organizationId);
    return this.buildChecklist(
      organization,
      await this.findAll(organization.id),
    );
  }

  async downloadMine(
    userId: string,
    documentType: OrganizationDocumentType,
  ): Promise<OrganizationDocumentDownloadDto> {
    const organization = await this.findForAdministratorOrThrow(userId);
    return this.createDownload(organization.id, documentType);
  }

  async downloadForReview(
    organizationId: string,
    documentType: OrganizationDocumentType,
  ): Promise<OrganizationDocumentDownloadDto> {
    await this.findOrganizationOrThrow(organizationId);
    return this.createDownload(organizationId, documentType);
  }

  async deleteMine(
    userId: string,
    documentType: OrganizationDocumentType,
  ): Promise<{ message: string }> {
    const organization = await this.findForAdministratorOrThrow(userId);
    this.assertDocumentTypeAllowed(organization, documentType);

    const removed = await this.dataSource.transaction(async (manager) => {
      const organizations = manager.withRepository(this.organizationRepository);
      const documents = manager.withRepository(this.documentRepository);
      const locked = await organizations.findOne({
        where: { id: organization.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('organization not found');
      this.assertDocumentsEditable(locked);

      const document = await this.findDocumentOrThrow(
        documents,
        organization.id,
        documentType,
      );
      await documents.remove(document);
      return document;
    });

    await this.deleteStoredObjectBestEffort(
      removed.bucket,
      removed.storage_key,
    );
    return { message: 'organization document deleted successfully' };
  }

  assertAllRequiredDocumentsPresent(
    organization: Organization,
    documents: OrganizationDocument[],
  ): void {
    const missing = this.getMissingDocumentTypes(organization, documents);
    if (missing.length) {
      throw new BadRequestException({
        message: 'all required organization documents must be uploaded',
        missing_document_types: missing,
      });
    }
  }

  private persistUpload(
    organizationId: string,
    userId: string,
    documentType: OrganizationDocumentType,
    file: IMulterFile,
    uploaded: IStorageUploadResult,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const organizations = manager.withRepository(this.organizationRepository);
      const documents = manager.withRepository(this.documentRepository);
      const organization = await organizations.findOne({
        where: { id: organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!organization) {
        throw new NotFoundException('organization not found');
      }
      this.assertDocumentsEditable(organization);
      this.assertDocumentTypeAllowed(organization, documentType);

      const replaced = await documents.findOne({
        where: { organization_id: organizationId, document_type: documentType },
      });
      const originalFilename = path.basename(
        file.originalname.trim().replace(/\\/g, '/'),
      );
      const saved = await documents.save(
        documents.create({
          id: replaced?.id,
          organization_id: organizationId,
          document_type: documentType,
          bucket: uploaded.bucket,
          storage_key: uploaded.key,
          original_filename: originalFilename,
          mime_type: uploaded.contentType,
          file_size: uploaded.size,
          uploaded_by_user_id: userId,
        }),
      );
      return { saved, replaced };
    });
  }

  private async createDownload(
    organizationId: string,
    documentType: OrganizationDocumentType,
  ): Promise<OrganizationDocumentDownloadDto> {
    const document = await this.findDocumentOrThrow(
      this.documentRepository,
      organizationId,
      documentType,
    );
    const filename = document.original_filename.replace(/["\r\n]/g, '_');
    return {
      url: await this.storageService.createSignedGetUrl({
        bucket: document.bucket,
        key: document.storage_key,
        expiresInSeconds: DOWNLOAD_TTL_SECONDS,
        responseContentDisposition: `attachment; filename="${filename}"`,
      }),
      expires_in_seconds: DOWNLOAD_TTL_SECONDS,
    };
  }

  private buildChecklist(
    organization: Organization,
    documents: OrganizationDocument[],
  ): OrganizationDocumentChecklistDto {
    const missing = this.getMissingDocumentTypes(organization, documents);
    return {
      documents: documents.map((document) => this.toDto(document)),
      missing_document_types: missing,
      is_complete: missing.length === 0,
    };
  }

  private getMissingDocumentTypes(
    organization: Organization,
    documents: OrganizationDocument[],
  ): OrganizationDocumentType[] {
    const uploaded = new Set(
      documents.map((document) => document.document_type),
    );
    return REQUIRED_ORGANIZATION_DOCUMENT_TYPES[
      organization.organization_type
    ].filter((type) => !uploaded.has(type));
  }

  private assertDocumentTypeAllowed(
    organization: Organization,
    documentType: OrganizationDocumentType,
  ): void {
    if (
      !REQUIRED_ORGANIZATION_DOCUMENT_TYPES[
        organization.organization_type
      ].includes(documentType)
    ) {
      throw new BadRequestException(
        `${documentType} is not required for ${organization.organization_type}`,
      );
    }
  }

  private assertDocumentsEditable(organization: Organization): void {
    if (!EDITABLE_STATUSES.has(organization.verification_status)) {
      throw new BadRequestException(
        'organization documents cannot be changed after review has started',
      );
    }
  }

  private findAll(organizationId: string) {
    return this.documentRepository.find({
      where: { organization_id: organizationId },
      order: { document_type: 'ASC' },
    });
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

  private async findDocumentOrThrow(
    repository: Repository<OrganizationDocument>,
    organizationId: string,
    documentType: OrganizationDocumentType,
  ): Promise<OrganizationDocument> {
    const document = await repository.findOne({
      where: { organization_id: organizationId, document_type: documentType },
    });
    if (!document) {
      throw new NotFoundException('organization document not found');
    }
    return document;
  }

  private async deleteStoredObjectBestEffort(bucket: string, key: string) {
    try {
      await this.storageService.deleteObject({ bucket, key });
    } catch (error) {
      this.logger.error('failed to clean up organization document object', {
        bucket,
        key,
        error,
      });
    }
  }

  private toDto(
    document: OrganizationDocument,
  ): OrganizationDocumentResponseDto {
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
}
