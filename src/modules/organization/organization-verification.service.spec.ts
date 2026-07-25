import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { OrganizationAdmin } from './entities/organization-admin.entity';
import { OrganizationDocument } from './entities/organization-document.entity';
import { OrganizationStatusHistory } from './entities/organization-status-history.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationType } from './enums/organization-type.enum';
import { OrganizationVerificationStatus } from './enums/organization-verification-status.enum';
import { OrganizationDocumentsService } from './organization-documents.service';
import { OrganizationVerificationService } from './organization-verification.service';

describe('OrganizationVerificationService', () => {
  const organization = {
    id: 'organization-id',
    organization_type: OrganizationType.HOSPITAL,
    verification_status: OrganizationVerificationStatus.PENDING,
    rejection_reason: null,
    updated_at: new Date(),
  } as Organization;
  const organizations = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    findAndCount: jest.fn(),
  };
  const administrators = { findOne: jest.fn() };
  const documents = { find: jest.fn().mockResolvedValue([]) };
  const history = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
  };
  const documentService = {
    assertAllRequiredDocumentsPresent: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({ withRepository: (repository: unknown) => repository }),
    ),
  };
  let service: OrganizationVerificationService;

  beforeEach(() => {
    service = new OrganizationVerificationService(
      organizations as unknown as Repository<Organization>,
      administrators as unknown as Repository<OrganizationAdmin>,
      documents as unknown as Repository<OrganizationDocument>,
      history as unknown as Repository<OrganizationStatusHistory>,
      documentService as unknown as OrganizationDocumentsService,
      dataSource as unknown as DataSource,
    );
    jest.clearAllMocks();
    organization.verification_status = OrganizationVerificationStatus.PENDING;
    organization.rejection_reason = null;
    organizations.findOne.mockResolvedValue(organization);
    administrators.findOne.mockResolvedValue({ organization });
  });

  it('submits only after rechecking all required documents', async () => {
    await service.submitMine('user-id');

    expect(
      documentService.assertAllRequiredDocumentsPresent,
    ).toHaveBeenCalledWith(organization, []);
    expect(history.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_status: OrganizationVerificationStatus.PENDING,
        new_status: OrganizationVerificationStatus.SUBMITTED,
        changed_by_user_id: 'user-id',
      }),
    );
  });

  it('rechecks documents when a reviewer picks up the application', async () => {
    organization.verification_status = OrganizationVerificationStatus.SUBMITTED;

    await service.markUnderReview(organization.id, 'reviewer-id');

    expect(
      documentService.assertAllRequiredDocumentsPresent,
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid lifecycle transitions', async () => {
    organization.verification_status =
      OrganizationVerificationStatus.UNDER_REVIEW;

    await expect(service.submitMine('user-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires and audits a rejection reason', async () => {
    organization.verification_status =
      OrganizationVerificationStatus.UNDER_REVIEW;

    await service.reject(organization.id, 'reviewer-id', {
      reason: ' Invalid registration ',
    });

    expect(organizations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: OrganizationVerificationStatus.REJECTED,
        rejection_reason: 'Invalid registration',
      }),
    );
    expect(history.save).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Invalid registration' }),
    );
  });

  it('rejects an empty rejection reason before opening a transaction', () => {
    organization.verification_status =
      OrganizationVerificationStatus.UNDER_REVIEW;

    expect(() =>
      service.reject(organization.id, 'reviewer-id', { reason: '   ' }),
    ).toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('approves an application only from under review', async () => {
    organization.verification_status =
      OrganizationVerificationStatus.UNDER_REVIEW;

    const result = await service.approve(organization.id, 'reviewer-id');

    expect(result.verification_status).toBe(
      OrganizationVerificationStatus.APPROVED,
    );
    expect(history.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_status: OrganizationVerificationStatus.UNDER_REVIEW,
        new_status: OrganizationVerificationStatus.APPROVED,
      }),
    );
  });

  it('returns a filtered, paginated reviewer queue', async () => {
    organizations.findAndCount.mockResolvedValue([[organization], 1]);

    const result = await service.listApplications({
      organization_type: OrganizationType.HOSPITAL,
      verification_status: OrganizationVerificationStatus.SUBMITTED,
      page: 2,
      limit: 10,
    });

    expect(organizations.findAndCount).toHaveBeenCalledWith({
      where: {
        organization_type: OrganizationType.HOSPITAL,
        verification_status: OrganizationVerificationStatus.SUBMITTED,
      },
      order: { created_at: 'ASC' },
      skip: 10,
      take: 10,
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 10 });
  });
});
