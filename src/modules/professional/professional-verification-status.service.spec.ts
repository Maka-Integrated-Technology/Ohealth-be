import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ProfessionalVerificationDocument } from './entities/professional-verification-document.entity';
import { ProfessionalVerificationStatusHistory } from './entities/professional-verification-status-history.entity';
import {
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';
import { ProfessionalVerificationDocumentType } from './enums/professional-verification-document-type.enum';
import { ProfessionalVerificationStatusService } from './professional-verification-status.service';

describe('ProfessionalVerificationStatusService', () => {
  let service: ProfessionalVerificationStatusService;

  const mockProfessionalRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
  };

  const mockHistoryRepository = {
    find: jest.fn(),
    create: jest.fn(
      (payload: Partial<ProfessionalVerificationStatusHistory>) => payload,
    ),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const pendingProfessional = {
    id: 'professional-id',
    user_id: 'user-id',
    verification_status: ProfessionalVerificationStatus.PENDING,
  } as Professional;

  const bothDocuments = [
    {
      document_type: ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
    },
    { document_type: ProfessionalVerificationDocumentType.GOVERNMENT_ID },
  ] as ProfessionalVerificationDocument[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalVerificationStatusService,
        {
          provide: getRepositoryToken(Professional),
          useValue: mockProfessionalRepository,
        },
        {
          provide: getRepositoryToken(ProfessionalVerificationDocument),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(ProfessionalVerificationStatusHistory),
          useValue: mockHistoryRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ProfessionalVerificationStatusService>(
      ProfessionalVerificationStatusService,
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
    mockProfessionalRepository.save.mockImplementation(
      async (payload: Professional) => payload,
    );
    mockDocumentRepository.find.mockResolvedValue(bothDocuments);
    mockHistoryRepository.save.mockImplementation(
      async (payload: Partial<ProfessionalVerificationStatusHistory>) =>
        payload,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should refuse to verify a professional with missing documents', async () => {
    mockDocumentRepository.find.mockResolvedValue([bothDocuments[0]]);

    await expect(
      service.verify('professional-id', 'admin-id'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockProfessionalRepository.save).not.toHaveBeenCalled();
  });

  it('should verify a professional once every required document is present', async () => {
    const result = await service.verify('professional-id', 'admin-id');

    expect(result.verification_status).toBe(
      ProfessionalVerificationStatus.VERIFIED,
    );
    expect(mockHistoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_status: ProfessionalVerificationStatus.PENDING,
        new_status: ProfessionalVerificationStatus.VERIFIED,
        changed_by_user_id: 'admin-id',
      }),
    );
  });

  it('should require a reason to reject', async () => {
    await expect(
      service.reject('professional-id', 'admin-id', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockProfessionalRepository.save).not.toHaveBeenCalled();
  });

  it('should reject with a reason even when documents are incomplete', async () => {
    mockDocumentRepository.find.mockResolvedValue([]);

    const result = await service.reject(
      'professional-id',
      'admin-id',
      'License could not be verified.',
    );

    expect(result.verification_status).toBe(
      ProfessionalVerificationStatus.REJECTED,
    );
    expect(mockHistoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        new_status: ProfessionalVerificationStatus.REJECTED,
        reason: 'License could not be verified.',
      }),
    );
  });

  it('should resolve the caller’s own professional profile for getMyStatus', async () => {
    const result = await service.getMyStatus('user-id');

    expect(mockProfessionalRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-id' },
    });
    expect(result.professional_id).toBe('professional-id');
    expect(result.documents_complete).toBe(true);
  });

  it('should not resolve another user’s professional profile', async () => {
    mockProfessionalRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getMyStatus('someone-elses-user-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
