import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import { IMulterFile } from '../../common/types';
import { VerificationDocumentFileValidator } from '../../common/validators/verification-document-file.validator';
import { StorageService } from '../storage/storage.service';

import { OrganizationAdmin } from './entities/organization-admin.entity';
import { OrganizationDocument } from './entities/organization-document.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationDocumentType } from './enums/organization-document-type.enum';
import { OrganizationType } from './enums/organization-type.enum';
import { OrganizationVerificationStatus } from './enums/organization-verification-status.enum';
import { OrganizationDocumentsService } from './organization-documents.service';

describe('OrganizationDocumentsService', () => {
  const organization = {
    id: 'organization-id',
    organization_type: OrganizationType.PHARMACY,
    verification_status: OrganizationVerificationStatus.PENDING,
  } as Organization;
  const organizations = { findOne: jest.fn() };
  const administrators = { findOne: jest.fn() };
  const documents = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const storage = {
    uploadPrivateObject: jest.fn(),
    deleteObject: jest.fn(),
    createSignedGetUrl: jest.fn(),
  };
  const validator = {
    validate: jest.fn().mockReturnValue({
      extension: '.pdf',
      mimeType: 'application/pdf',
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({ withRepository: (repository: unknown) => repository }),
    ),
  };
  const logger = {
    child: jest.fn().mockReturnThis(),
    error: jest.fn(),
  };
  const file = {
    originalname: 'license.pdf',
    mimetype: 'application/pdf',
    size: 5,
    buffer: Buffer.from('%PDF-'),
  } as IMulterFile;
  let service: OrganizationDocumentsService;

  beforeEach(() => {
    service = new OrganizationDocumentsService(
      organizations as unknown as Repository<Organization>,
      administrators as unknown as Repository<OrganizationAdmin>,
      documents as unknown as Repository<OrganizationDocument>,
      dataSource as unknown as DataSource,
      storage as unknown as StorageService,
      validator as unknown as VerificationDocumentFileValidator,
      logger as unknown as Logger,
    );
    jest.clearAllMocks();
    organization.verification_status = OrganizationVerificationStatus.PENDING;
    administrators.findOne.mockResolvedValue({ organization });
    organizations.findOne.mockResolvedValue(organization);
    documents.find.mockResolvedValue([]);
    documents.findOne.mockResolvedValue(null);
    documents.save.mockImplementation(async (value) => ({
      ...value,
      id: 'document-id',
      created_at: new Date(),
      updated_at: new Date(),
    }));
    storage.uploadPrivateObject.mockResolvedValue({
      bucket: 'private',
      key: 'stored-key',
      contentType: 'application/pdf',
      size: file.size,
    });
    storage.createSignedGetUrl.mockResolvedValue('https://signed.example');
  });

  it('uploads a private typed document and stores only its reference', async () => {
    const result = await service.uploadMine(
      'user-id',
      OrganizationDocumentType.OPERATING_LICENSE,
      file,
    );

    expect(storage.uploadPrivateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        body: file.buffer,
        metadata: {
          organization_id: organization.id,
          document_type: OrganizationDocumentType.OPERATING_LICENSE,
          uploaded_by_user_id: 'user-id',
        },
      }),
    );
    expect(documents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: organization.id,
        storage_key: 'stored-key',
      }),
    );
    expect(result.id).toBe('document-id');
  });

  it('cleans up the new S3 object when database persistence fails', async () => {
    documents.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.uploadMine(
        'user-id',
        OrganizationDocumentType.OPERATING_LICENSE,
        file,
      ),
    ).rejects.toThrow('database unavailable');
    expect(storage.deleteObject).toHaveBeenCalledWith({
      bucket: 'private',
      key: 'stored-key',
    });
  });

  it('deletes the replaced S3 object only after persistence succeeds', async () => {
    documents.findOne.mockResolvedValue({
      id: 'existing-document-id',
      bucket: 'private',
      storage_key: 'old-key',
    });

    await service.uploadMine(
      'user-id',
      OrganizationDocumentType.OPERATING_LICENSE,
      file,
    );

    expect(storage.deleteObject).toHaveBeenCalledWith({
      bucket: 'private',
      key: 'old-key',
    });
  });

  it('rejects document types not required for the organization type', async () => {
    await expect(
      service.uploadMine(
        'user-id',
        OrganizationDocumentType.ACCREDITATION_CERTIFICATE,
        file,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it('locks document changes after review starts', async () => {
    organization.verification_status =
      OrganizationVerificationStatus.UNDER_REVIEW;

    await expect(
      service.uploadMine(
        'user-id',
        OrganizationDocumentType.OPERATING_LICENSE,
        file,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports organization-specific missing documents', () => {
    expect(() =>
      service.assertAllRequiredDocumentsPresent(organization, []),
    ).toThrow(BadRequestException);
  });

  it('returns an owner-scoped document checklist', async () => {
    documents.find.mockResolvedValue([
      {
        id: 'document-id',
        document_type: OrganizationDocumentType.OPERATING_LICENSE,
        original_filename: 'license.pdf',
        mime_type: 'application/pdf',
        file_size: 5,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const result = await service.listMine('user-id');

    expect(documents.find).toHaveBeenCalledWith({
      where: { organization_id: organization.id },
      order: { document_type: 'ASC' },
    });
    expect(result.documents).toHaveLength(1);
    expect(result.is_complete).toBe(false);
  });

  it('creates a short-lived private owner download URL', async () => {
    documents.findOne.mockResolvedValue({
      bucket: 'private',
      storage_key: 'stored-key',
      original_filename: 'license.pdf',
    });

    const result = await service.downloadMine(
      'user-id',
      OrganizationDocumentType.OPERATING_LICENSE,
    );

    expect(storage.createSignedGetUrl).toHaveBeenCalledWith({
      bucket: 'private',
      key: 'stored-key',
      expiresInSeconds: 300,
      responseContentDisposition: 'attachment; filename="license.pdf"',
    });
    expect(result).toEqual({
      url: 'https://signed.example',
      expires_in_seconds: 300,
    });
  });

  it('removes the database record before cleaning up its S3 object', async () => {
    const document = {
      bucket: 'private',
      storage_key: 'stored-key',
      document_type: OrganizationDocumentType.OPERATING_LICENSE,
    };
    documents.findOne.mockResolvedValue(document);

    await service.deleteMine(
      'user-id',
      OrganizationDocumentType.OPERATING_LICENSE,
    );

    expect(documents.remove).toHaveBeenCalledWith(document);
    expect(storage.deleteObject).toHaveBeenCalledWith({
      bucket: 'private',
      key: 'stored-key',
    });
  });
});
