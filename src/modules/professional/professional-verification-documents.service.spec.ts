import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

import { IMulterFile } from '../../common/types';
import { StorageService } from '../storage/storage.service';

import { ProfessionalVerificationDocument } from './entities/professional-verification-document.entity';
import {
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';
import { ProfessionalVerificationDocumentType } from './enums/professional-verification-document-type.enum';
import { ProfessionalVerificationDocumentFileValidator } from './professional-verification-document-file.validator';
import { ProfessionalVerificationDocumentsService } from './professional-verification-documents.service';

describe('ProfessionalVerificationDocumentsService', () => {
  let service: ProfessionalVerificationDocumentsService;

  const createdAt = new Date('2026-07-15T10:00:00.000Z');
  const updatedAt = new Date('2026-07-15T10:05:00.000Z');

  const mockProfessionalRepository = {
    findOne: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(
      (payload: Partial<ProfessionalVerificationDocument>) => payload,
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

  const pendingProfessional = {
    id: 'professional-id',
    user_id: 'user-id',
    verification_status: ProfessionalVerificationStatus.PENDING,
  } as Professional;

  const verifiedProfessional = {
    id: 'professional-id',
    user_id: 'user-id',
    verification_status: ProfessionalVerificationStatus.VERIFIED,
  } as Professional;

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
    professional_id: pendingProfessional.id,
    document_type: ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
    bucket: 'private-bucket',
    storage_key:
      'professionals/professional-id/verification-documents/license.pdf',
    original_filename: 'license.pdf',
    mime_type: 'application/pdf',
    file_size: 11,
    uploaded_by_user_id: 'user-id',
    created_at: createdAt,
    updated_at: updatedAt,
  } as ProfessionalVerificationDocument;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalVerificationDocumentsService,
        ProfessionalVerificationDocumentFileValidator,
        {
          provide: getRepositoryToken(Professional),
          useValue: mockProfessionalRepository,
        },
        {
          provide: getRepositoryToken(ProfessionalVerificationDocument),
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

    service = module.get<ProfessionalVerificationDocumentsService>(
      ProfessionalVerificationDocumentsService,
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
    mockProfessionalRepository.findOne.mockResolvedValue(pendingProfessional);
    mockDocumentRepository.findOne.mockResolvedValue(null);
    mockDocumentRepository.find.mockResolvedValue([]);
    mockDocumentRepository.save.mockImplementation(
      async (payload: Partial<ProfessionalVerificationDocument>) => ({
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
      key: 'professionals/professional-id/verification-documents/professional_license-uuid.pdf',
      contentType: 'application/pdf',
      size: uploadFile.size,
    });
    mockStorageService.createSignedGetUrl.mockResolvedValue(
      'https://signed-url.test/license.pdf',
    );
    mockStorageService.deleteObject.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upload and tag a professional verification document', async () => {
    const result = await service.uploadMyDocument(
      'user-id',
      ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
      uploadFile,
    );

    expect(mockProfessionalRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-id' },
    });
    expect(mockStorageService.uploadPrivateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(
          /^professionals\/professional-id\/verification-documents\/professional_license-[0-9a-f-]{36}\.pdf$/,
        ),
        body: uploadFile.buffer,
        contentType: 'application/pdf',
        metadata: {
          professional_id: 'professional-id',
          document_type:
            ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
          uploaded_by_user_id: 'user-id',
        },
      }),
    );
    expect(result.document_type).toBe(
      ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
    );
  });

  it('should reject an unrecognized document type before touching storage', async () => {
    await expect(
      service.uploadMyDocument(
        'user-id',
        'passport' as ProfessionalVerificationDocumentType,
        uploadFile,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockStorageService.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it('should refuse uploads once verification has left the pending state', async () => {
    mockProfessionalRepository.findOne.mockResolvedValue(verifiedProfessional);

    await expect(
      service.uploadMyDocument(
        'user-id',
        ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
        uploadFile,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockStorageService.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it('should refuse deletion once verification has left the pending state', async () => {
    mockProfessionalRepository.findOne.mockResolvedValue(verifiedProfessional);

    await expect(
      service.deleteMyDocument(
        'user-id',
        ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockDocumentRepository.remove).not.toHaveBeenCalled();
  });

  it('should not leak whose document set is missing across users without a professional profile', async () => {
    mockProfessionalRepository.findOne.mockResolvedValue(null);

    await expect(service.listMyDocuments('user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should report missing document types and completeness', async () => {
    mockDocumentRepository.find.mockResolvedValue([document]);

    const status =
      await service.listDocumentsForProfessional('professional-id');

    expect(status.missing_document_types).toEqual([
      ProfessionalVerificationDocumentType.GOVERNMENT_ID,
    ]);
    expect(status.is_complete).toBe(false);
  });

  it('should clean up the newly stored object if persistence fails', async () => {
    mockDocumentRepository.save.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.uploadMyDocument(
        'user-id',
        ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
        uploadFile,
      ),
    ).rejects.toThrow('db down');

    expect(mockStorageService.deleteObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: 'professionals/professional-id/verification-documents/professional_license-uuid.pdf',
    });
  });

  it('should scope a download URL to the requesting professional’s own document', async () => {
    mockDocumentRepository.findOne.mockResolvedValue(document);

    const result = await service.createMyDocumentDownloadUrl(
      'user-id',
      ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
    );

    expect(mockStorageService.createSignedGetUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: document.bucket,
        key: document.storage_key,
      }),
    );
    expect(result.url).toBe('https://signed-url.test/license.pdf');
  });
});
