import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { LaboratoryVerificationStatusHistory } from './entities/laboratory-verification-status-history.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryOnboardingStatus } from './enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from './enums/laboratory-verification-status.enum';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';
import { LaboratoryVerificationStatusService } from './laboratory-verification-status.service';

describe('LaboratoryVerificationStatusService', () => {
  let service: LaboratoryVerificationStatusService;

  const updatedAt = new Date('2026-07-17T10:30:00.000Z');

  const mockLaboratoryRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockLaboratoryAdminRepository = {
    findOne: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
  };

  const mockHistoryRepository = {
    create: jest.fn(
      (payload: Partial<LaboratoryVerificationStatusHistory>) => payload,
    ),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockVerificationDocumentsService = {
    assertAllRequiredDocumentsPresent: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const pendingLaboratory = {
    id: 'laboratory-id',
    verification_status: LaboratoryVerificationStatus.PENDING,
    onboarding_status: LaboratoryOnboardingStatus.ADMIN_SETUP_COMPLETED,
    verification_rejection_reason: null,
    updated_at: updatedAt,
  } as Laboratory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryVerificationStatusService,
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
          provide: getRepositoryToken(LaboratoryVerificationStatusHistory),
          useValue: mockHistoryRepository,
        },
        {
          provide: LaboratoryVerificationDocumentsService,
          useValue: mockVerificationDocumentsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<LaboratoryVerificationStatusService>(
      LaboratoryVerificationStatusService,
    );

    jest.clearAllMocks();
    mockDocumentRepository.find.mockResolvedValue([]);
    mockVerificationDocumentsService.assertAllRequiredDocumentsPresent.mockImplementation(
      () => undefined,
    );
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
    mockLaboratoryRepository.save.mockImplementation(
      async (laboratory: Laboratory) => laboratory,
    );
    mockHistoryRepository.save.mockImplementation(
      async (history: Partial<LaboratoryVerificationStatusHistory>) => ({
        id: 'history-id',
        created_at: updatedAt,
        ...history,
      }),
    );
  });

  it('should return the current laboratory status for the lab admin', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: pendingLaboratory,
    });

    const result = await service.getMyStatus('admin-user-id');

    expect(mockLaboratoryAdminRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'admin-user-id' },
      relations: ['laboratory'],
    });
    expect(result).toEqual({
      laboratory_id: 'laboratory-id',
      verification_status: LaboratoryVerificationStatus.PENDING,
      onboarding_status: LaboratoryOnboardingStatus.ADMIN_SETUP_COMPLETED,
      verification_rejection_reason: null,
      updated_at: updatedAt,
    });
  });

  it('should submit verification only after all required documents are present', async () => {
    const documents = [
      { id: 'document-id' },
    ] as LaboratoryVerificationDocument[];
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: pendingLaboratory,
    });
    mockDocumentRepository.find.mockResolvedValue(documents);
    mockLaboratoryRepository.findOne.mockResolvedValue({
      ...pendingLaboratory,
    });

    const result = await service.submitMyVerification('admin-user-id');

    expect(mockDocumentRepository.find).toHaveBeenCalledWith({
      where: { laboratory_id: 'laboratory-id' },
    });
    expect(mockLaboratoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'laboratory-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(
      mockVerificationDocumentsService.assertAllRequiredDocumentsPresent,
    ).toHaveBeenCalledWith(documents);
    expect(mockLaboratoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: LaboratoryVerificationStatus.SUBMITTED,
        onboarding_status: LaboratoryOnboardingStatus.VERIFICATION_SUBMITTED,
        verification_rejection_reason: null,
      }),
    );
    expect(mockHistoryRepository.create).toHaveBeenCalledWith({
      laboratory_id: 'laboratory-id',
      previous_status: LaboratoryVerificationStatus.PENDING,
      new_status: LaboratoryVerificationStatus.SUBMITTED,
      reason: null,
      changed_by_user_id: 'admin-user-id',
    });
    expect(result.verification_status).toBe(
      LaboratoryVerificationStatus.SUBMITTED,
    );
  });

  it('should block submission when required documents are missing', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: pendingLaboratory,
    });
    mockDocumentRepository.find.mockResolvedValue([]);
    mockVerificationDocumentsService.assertAllRequiredDocumentsPresent.mockImplementation(
      () => {
        throw new BadRequestException('missing documents');
      },
    );

    await expect(service.submitMyVerification('admin-user-id')).rejects.toThrow(
      BadRequestException,
    );

    expect(mockLaboratoryRepository.save).not.toHaveBeenCalled();
    expect(mockHistoryRepository.save).not.toHaveBeenCalled();
  });

  it('should move a submitted laboratory to under review', async () => {
    const documents = [
      { id: 'document-id' },
    ] as LaboratoryVerificationDocument[];
    const submittedLaboratory = {
      ...pendingLaboratory,
      verification_status: LaboratoryVerificationStatus.SUBMITTED,
      onboarding_status: LaboratoryOnboardingStatus.VERIFICATION_SUBMITTED,
    } as Laboratory;
    mockLaboratoryRepository.findOne.mockResolvedValue(submittedLaboratory);
    mockDocumentRepository.find.mockResolvedValue(documents);

    const result = await service.markUnderReview(
      'laboratory-id',
      'admin-user-id',
    );

    expect(mockLaboratoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: LaboratoryVerificationStatus.UNDER_REVIEW,
      }),
    );
    expect(mockLaboratoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'laboratory-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(
      mockVerificationDocumentsService.assertAllRequiredDocumentsPresent,
    ).toHaveBeenCalledWith(documents);
    expect(result.verification_status).toBe(
      LaboratoryVerificationStatus.UNDER_REVIEW,
    );
  });

  it('should not start review when required documents are missing', async () => {
    const submittedLaboratory = {
      ...pendingLaboratory,
      verification_status: LaboratoryVerificationStatus.SUBMITTED,
      onboarding_status: LaboratoryOnboardingStatus.VERIFICATION_SUBMITTED,
    } as Laboratory;
    mockLaboratoryRepository.findOne.mockResolvedValue(submittedLaboratory);
    mockDocumentRepository.find.mockResolvedValue([]);
    mockVerificationDocumentsService.assertAllRequiredDocumentsPresent.mockImplementation(
      () => {
        throw new BadRequestException('missing documents');
      },
    );

    await expect(
      service.markUnderReview('laboratory-id', 'admin-user-id'),
    ).rejects.toThrow(BadRequestException);

    expect(mockLaboratoryRepository.save).not.toHaveBeenCalled();
    expect(mockHistoryRepository.save).not.toHaveBeenCalled();
  });

  it('should approve an under-review laboratory and clear rejection reason', async () => {
    const underReviewLaboratory = {
      ...pendingLaboratory,
      verification_status: LaboratoryVerificationStatus.UNDER_REVIEW,
      verification_rejection_reason: 'old reason',
    } as Laboratory;
    mockLaboratoryRepository.findOne.mockResolvedValue(underReviewLaboratory);

    const result = await service.approve('laboratory-id', 'admin-user-id');

    expect(mockLaboratoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: LaboratoryVerificationStatus.APPROVED,
        onboarding_status: LaboratoryOnboardingStatus.VERIFIED,
        verification_rejection_reason: null,
      }),
    );
    expect(result.verification_status).toBe(
      LaboratoryVerificationStatus.APPROVED,
    );
  });

  it('should reject an under-review laboratory with a reason', async () => {
    const underReviewLaboratory = {
      ...pendingLaboratory,
      verification_status: LaboratoryVerificationStatus.UNDER_REVIEW,
    } as Laboratory;
    mockLaboratoryRepository.findOne.mockResolvedValue(underReviewLaboratory);

    const result = await service.reject('laboratory-id', 'admin-user-id', {
      reason: ' The license is expired. ',
    });

    expect(mockLaboratoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: LaboratoryVerificationStatus.REJECTED,
        verification_rejection_reason: 'The license is expired.',
      }),
    );
    expect(mockHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'The license is expired.',
      }),
    );
    expect(result.verification_status).toBe(
      LaboratoryVerificationStatus.REJECTED,
    );
  });

  it('should require a non-empty rejection reason', async () => {
    mockLaboratoryRepository.findOne.mockResolvedValue(pendingLaboratory);

    await expect(
      service.reject('laboratory-id', 'admin-user-id', { reason: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should require a rejection reason when request body is missing', async () => {
    mockLaboratoryRepository.findOne.mockResolvedValue(pendingLaboratory);

    await expect(
      service.reject(
        'laboratory-id',
        'admin-user-id',
        undefined as unknown as { reason: string },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid status transitions', async () => {
    const submittedLaboratory = {
      ...pendingLaboratory,
      verification_status: LaboratoryVerificationStatus.SUBMITTED,
    } as Laboratory;
    mockLaboratoryRepository.findOne.mockResolvedValue(submittedLaboratory);

    await expect(
      service.approve('laboratory-id', 'admin-user-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should list audit history for a laboratory', async () => {
    mockLaboratoryRepository.findOne.mockResolvedValue(pendingLaboratory);
    mockHistoryRepository.find.mockResolvedValue([
      {
        id: 'history-id',
        laboratory_id: 'laboratory-id',
        previous_status: LaboratoryVerificationStatus.SUBMITTED,
        new_status: LaboratoryVerificationStatus.UNDER_REVIEW,
        reason: null,
        changed_by_user_id: 'admin-user-id',
        created_at: updatedAt,
      },
    ]);

    const result = await service.listHistory('laboratory-id');

    expect(mockHistoryRepository.find).toHaveBeenCalledWith({
      where: { laboratory_id: 'laboratory-id' },
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual([
      {
        id: 'history-id',
        laboratory_id: 'laboratory-id',
        previous_status: LaboratoryVerificationStatus.SUBMITTED,
        new_status: LaboratoryVerificationStatus.UNDER_REVIEW,
        reason: null,
        changed_by_user_id: 'admin-user-id',
        created_at: updatedAt,
      },
    ]);
  });

  it('should throw when laboratory is not found', async () => {
    mockLaboratoryRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getStatusForLaboratory('missing-laboratory-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
