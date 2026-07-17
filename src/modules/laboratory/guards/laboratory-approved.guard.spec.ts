import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LaboratoryAdmin } from '../entities/laboratory-admin.entity';
import { Laboratory } from '../entities/laboratory.entity';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

import { LaboratoryApprovedGuard } from './laboratory-approved.guard';

describe('LaboratoryApprovedGuard', () => {
  let guard: LaboratoryApprovedGuard;

  const mockLaboratoryAdminRepository = {
    findOne: jest.fn(),
  };

  const buildContext = (user?: { id?: string; userId?: string }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryApprovedGuard,
        {
          provide: getRepositoryToken(LaboratoryAdmin),
          useValue: mockLaboratoryAdminRepository,
        },
      ],
    }).compile();

    guard = module.get(LaboratoryApprovedGuard);
    jest.clearAllMocks();
  });

  it('should allow approved laboratory administrators', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: {
        verification_status: LaboratoryVerificationStatus.APPROVED,
      } as Laboratory,
    });

    await expect(
      guard.canActivate(buildContext({ userId: 'user-id' })),
    ).resolves.toBe(true);

    expect(mockLaboratoryAdminRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-id' },
      relations: ['laboratory'],
    });
  });

  it('should reject unauthenticated requests', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject users without a laboratory administrator profile', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue(null);

    await expect(
      guard.canActivate(buildContext({ id: 'user-id' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject laboratory administrators before approval', async () => {
    mockLaboratoryAdminRepository.findOne.mockResolvedValue({
      laboratory: {
        verification_status: LaboratoryVerificationStatus.UNDER_REVIEW,
      } as Laboratory,
    });

    await expect(
      guard.canActivate(buildContext({ id: 'user-id' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
