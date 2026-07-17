import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

import { IMulterFile } from '../../common/types';
import { MAX_LAB_VERIFICATION_DOCUMENT_SIZE } from '../../constants/file-upload.constants';
import { StorageService } from '../storage/storage.service';

import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { Laboratory } from './entities/laboratory.entity';
import {
  LaboratoryVerificationDocumentType,
  REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES,
} from './enums/laboratory-verification-document-type.enum';
import { LaboratoryVerificationStatus } from './enums/laboratory-verification-status.enum';
import { LaboratoryVerificationDocumentFileValidator } from './laboratory-verification-document-file.validator';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';

describe('LaboratoryVerificationDocumentsService', () => {
  let service: LaboratoryVerificationDocumentsService;

  const createdAt = new Date('2026-07-15T10:00:00.000Z');
  const updatedAt = new Date('2026-07-15T10:05:00.000Z');

  const mockLaboratoryRepository = {
    findOne: jest.fn(),
  };

  const mockLaboratoryAdminRepository = {
    findOne: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(
      (payload: Partial<LaboratoryVerificationDocument>) => payload,
    ),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockStorageService = {
    uploadPrivateObject: jest.fn(),
    createSignedGetUrl: jest.fn(),
    deleteObject: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) =>
      key === 'storage.aws.s3.signedUrlTtlSeconds' ? 900 : undefined,
    ),
  };

  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  const laboratory = {
    id: 'laboratory-id',
    verification_status: LaboratoryVerificationStatus.PENDING,
  } as Laboratory;

  const approvedLaboratory = {
    id: 'laboratory-id',
    verification_status: LaboratoryVerificationStatus.APPROVED,
  } as Laboratory;

  const rejectedLaboratory = {
    id: 'laboratory-id',
    verification_status: LaboratoryVerificationStatus.REJECTED,
  } as Laboratory;

  const submittedLaboratory = {
    id: 'laboratory-id',
    verification_status: LaboratoryVerificationStatus.SUBMITTED,
  } as Laboratory;

  const underReviewLaboratory = {
    id: 'laboratory-id',
    verification_status: LaboratoryVerificationStatus.UNDER_REVIEW,
  } as Laboratory;

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const pdfBuffer = Buffer.from('%PDF-1.7\n');

  const uploadFile: IMulterFile = {
    fieldname: 'file',
    originalname: '../license.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: pdfBuffer.length,
    buffer: pdfBuffer,
  };

  const document = {
    id: 'document-id',
    laboratory_id: laboratory.id,
    document_type: LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    bucket: 'private-bucket',
    storage_key:
      'laboratories/laboratory-id/verification-documents/license.pdf',
    original_filename: 'license.pdf',
    mime_type: 'application/pdf',
    file_size: 11,
    uploaded_by_user_id: 'user-id',
    created_at: createdAt,
    updated_at: updatedAt,
  } as LaboratoryVerificationDocument;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryVerificationDocumentsService,
        LaboratoryVerificationDocumentFileValidator,
        {
          provide: getRepositoryToken(Laboratory),
          useValue: mockLaboratoryRepository,
        },
        {
          provide: getRepositoryToken(LaboratoryAdmin),
          useValue: mockLaboratoryAdminRepository,
        },
        {
          provide: getRepositoryToken(LaboratoryVerificationDocument),
          useValue: mockDocumentRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<LaboratoryVerificationDocumentsService>(
      LaboratoryVerificationDocumentsService,
    );

    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation(
      async (
        callback: (manager: {
          withRepository: <T>(repository: T) => T;
        }) => Promise<unknown>,
      ) =>
        callback({
          withRepository: <T>(repository: T) => repository,
        }),
    );
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({ laboratory });
    mockLaboratoryRepository.findOne.mockResolvedValue(laboratory);
    mockDocumentRepository.findOne.mockResolvedValue(null);
    mockDocumentRepository.find.mockResolvedValue([]);
    mockDocumentRepository.save.mockImplementation(
      async (payload: Partial<LaboratoryVerificationDocument>) => ({
        ...document,
        ...payload,
        id: payload.id ?? document.id,
        created_at: createdAt,
        updated_at: updatedAt,
      }),
    );
    mockDocumentRepository.remove.mockResolvedValue(document);
    mockStorageService.uploadPrivateObject.mockResolvedValue({
      bucket: 'private-bucket',
      key: 'laboratories/laboratory-id/verification-documents/laboratory_license-1770000000000.pdf',
      contentType: 'application/pdf',
      size: uploadFile.size,
    });
    mockStorageService.createSignedGetUrl.mockResolvedValue(
      'https://signed-url.test/license.pdf',
    );
    mockStorageService.deleteObject.mockResolvedValue(undefined);
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'storage.aws.s3.signedUrlTtlSeconds' ? 900 : undefined,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upload and tag a laboratory verification document', async () => {
    const result = await service.uploadMyDocument(
      'user-id',
      LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
      uploadFile,
    );

    expect(mockLaboratoryAdminRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-id' },
      relations: ['laboratory'],
    });
    expect(mockStorageService.uploadPrivateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(
          /^laboratories\/laboratory-id\/verification-documents\/laboratory_license-[0-9a-f-]{36}\.pdf$/,
        ),
        body: uploadFile.buffer,
        contentType: 'application/pdf',
        metadata: {
          laboratory_id: 'laboratory-id',
          document_type: LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
          uploaded_by_user_id: 'user-id',
        },
      }),
    );
    expect(mockLaboratoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: laboratory.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(mockDocumentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        laboratory_id: 'laboratory-id',
        document_type: LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        bucket: 'private-bucket',
        original_filename: 'license.pdf',
        mime_type: 'application/pdf',
        file_size: uploadFile.size,
        uploaded_by_user_id: 'user-id',
      }),
    );
    expect(result).toEqual({
      id: 'document-id',
      document_type: LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
      original_filename: 'license.pdf',
      mime_type: 'application/pdf',
      file_size: uploadFile.size,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  });

  it('should replace an existing document and remove the old S3 object', async () => {
    mockDocumentRepository.findOne.mockResolvedValue(document);
    mockStorageService.deleteObject.mockRejectedValueOnce(
      new Error('old object delete failed'),
    );

    await expect(
      service.uploadMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        uploadFile,
      ),
    ).resolves.toMatchObject({
      id: 'document-id',
      document_type: LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    });

    expect(mockDocumentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: document.id }),
    );
    expect(mockStorageService.deleteObject).toHaveBeenCalledWith({
      bucket: document.bucket,
      key: document.storage_key,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to clean up laboratory verification document',
      expect.objectContaining({
        bucket: document.bucket,
        key: document.storage_key,
      }),
    );
  });

  it('should delete the uploaded object if persistence fails', async () => {
    mockDocumentRepository.save.mockRejectedValue(new Error('save failed'));
    mockStorageService.deleteObject.mockRejectedValueOnce(
      new Error('cleanup failed'),
    );

    await expect(
      service.uploadMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        uploadFile,
      ),
    ).rejects.toThrow('save failed');

    expect(mockStorageService.deleteObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: 'laboratories/laboratory-id/verification-documents/laboratory_license-1770000000000.pdf',
    });
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should reject unsupported or oversized uploads', async () => {
    await expect(
      service.uploadMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        {
          ...uploadFile,
          mimetype: 'text/plain',
        },
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        {
          ...uploadFile,
          size: MAX_LAB_VERIFICATION_DOCUMENT_SIZE + 1,
        },
      ),
    ).rejects.toThrow(PayloadTooLargeException);

    expect(mockStorageService.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it('should list uploaded and missing required document types', async () => {
    mockDocumentRepository.find.mockResolvedValue([document]);

    const result = await service.listDocumentsForLaboratory('laboratory-id');

    expect(mockLaboratoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'laboratory-id' },
    });
    expect(result.documents).toHaveLength(1);
    expect(result.missing_document_types).toEqual(
      REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES.filter(
        (type) =>
          type !== LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
      ),
    );
    expect(result.is_complete).toBe(false);
  });

  it('should derive completeness from required types instead of row count', async () => {
    mockDocumentRepository.find.mockResolvedValue(
      Array.from(
        { length: REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES.length },
        (_, index) => ({
          ...document,
          id: `document-${index}`,
          document_type: 'unexpected_type',
        }),
      ),
    );

    const result = await service.listDocumentsForLaboratory('laboratory-id');

    expect(result.documents).toHaveLength(4);
    expect(result.missing_document_types).toEqual(
      REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES,
    );
    expect(result.is_complete).toBe(false);
  });

  it('should create a signed download URL for a document', async () => {
    mockDocumentRepository.findOne.mockResolvedValue(document);

    const result = await service.createMyDocumentDownloadUrl(
      'user-id',
      LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    );

    expect(mockStorageService.createSignedGetUrl).toHaveBeenCalledWith({
      bucket: document.bucket,
      key: document.storage_key,
      expiresInSeconds: 900,
      responseContentDisposition: 'attachment; filename="license.pdf"',
    });
    expect(result).toEqual({
      url: 'https://signed-url.test/license.pdf',
      expires_in_seconds: 900,
    });
  });

  it('should delete a document while the laboratory is editable', async () => {
    mockDocumentRepository.findOne.mockResolvedValue(document);
    mockStorageService.deleteObject.mockRejectedValueOnce(
      new Error('cleanup failed'),
    );

    const result = await service.deleteMyDocument(
      'user-id',
      LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    );

    expect(mockDocumentRepository.remove).toHaveBeenCalledWith(document);
    expect(mockLaboratoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: laboratory.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(mockStorageService.deleteObject).toHaveBeenCalledWith({
      bucket: document.bucket,
      key: document.storage_key,
    });
    expect(result).toEqual({
      message: 'laboratory verification document deleted successfully',
    });
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should allow document changes while verification is submitted', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: submittedLaboratory,
    });
    mockLaboratoryRepository.findOne.mockResolvedValue(submittedLaboratory);
    mockDocumentRepository.findOne.mockResolvedValue(document);

    await expect(
      service.deleteMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
      ),
    ).resolves.toEqual({
      message: 'laboratory verification document deleted successfully',
    });

    expect(mockDocumentRepository.remove).toHaveBeenCalledWith(document);
  });

  it('should allow document replacement while verification is submitted', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: submittedLaboratory,
    });
    mockLaboratoryRepository.findOne.mockResolvedValue(submittedLaboratory);
    mockDocumentRepository.findOne.mockResolvedValue(document);

    await expect(
      service.uploadMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        uploadFile,
      ),
    ).resolves.toMatchObject({ id: document.id });

    expect(mockDocumentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: document.id }),
    );
  });

  it('should recheck status under lock before persisting an upload', async () => {
    mockLaboratoryRepository.findOne.mockResolvedValue(underReviewLaboratory);

    await expect(
      service.uploadMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        uploadFile,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(mockDocumentRepository.save).not.toHaveBeenCalled();
    expect(mockStorageService.deleteObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: 'laboratories/laboratory-id/verification-documents/laboratory_license-1770000000000.pdf',
    });
  });

  it('should recheck status under lock before deleting a document', async () => {
    mockDocumentRepository.findOne.mockResolvedValue(document);
    mockLaboratoryRepository.findOne.mockResolvedValue(underReviewLaboratory);

    await expect(
      service.deleteMyDocument(
        'user-id',
        LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(mockDocumentRepository.remove).not.toHaveBeenCalled();
    expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
  });

  it.each([underReviewLaboratory, approvedLaboratory, rejectedLaboratory])(
    'should block document changes when verification status is $verification_status',
    async (nonEditableLaboratory) => {
      mockLaboratoryAdminRepository.findOne.mockResolvedValue({
        laboratory: nonEditableLaboratory,
      });

      await expect(
        service.deleteMyDocument(
          'user-id',
          LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDocumentRepository.remove).not.toHaveBeenCalled();
    },
  );

  it('should require every mandatory document before submission', () => {
    expect(() => service.assertAllRequiredDocumentsPresent([document])).toThrow(
      BadRequestException,
    );

    const completeDocuments =
      REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES.map(
        (documentType) =>
          ({
            ...document,
            id: `document-${documentType}`,
            document_type: documentType,
          }) as LaboratoryVerificationDocument,
      );

    expect(() =>
      service.assertAllRequiredDocumentsPresent(completeDocuments),
    ).not.toThrow();
  });
});
