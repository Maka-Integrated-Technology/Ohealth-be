import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthCapability } from '../auth/context/auth-capability';
import { AUTH_CAPABILITIES_KEY } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { LaboratoryVerificationDocumentType } from './enums/laboratory-verification-document-type.enum';
import { LaboratoryVerificationDocumentsController } from './laboratory-verification-documents.controller';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';

describe('LaboratoryVerificationDocumentsController', () => {
  let controller: LaboratoryVerificationDocumentsController;

  const service = {
    uploadMyDocument: jest.fn(),
    listMyDocuments: jest.fn(),
    createMyDocumentDownloadUrl: jest.fn(),
    deleteMyDocument: jest.fn(),
    listDocumentsForLaboratory: jest.fn(),
    createAdminDocumentDownloadUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaboratoryVerificationDocumentsController],
      providers: [
        {
          provide: LaboratoryVerificationDocumentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get(LaboratoryVerificationDocumentsController);
    jest.clearAllMocks();
  });

  it('should protect every endpoint with JWT and capability guards', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      LaboratoryVerificationDocumentsController,
    );

    expect(guards).toEqual([JwtAuthGuard, CapabilitiesGuard]);
  });

  it.each([
    'uploadMyDocument',
    'listMyDocuments',
    'downloadMyDocument',
    'deleteMyDocument',
  ] as const)('should restrict %s to laboratory administrators', (handler) => {
    expect(
      Reflect.getMetadata(AUTH_CAPABILITIES_KEY, controller[handler]),
    ).toEqual([AuthCapability.ORGANIZATION_ONBOARDING]);
  });

  it.each(['listLaboratoryDocuments', 'downloadLaboratoryDocument'] as const)(
    'should restrict %s to platform administrators',
    (handler) => {
      expect(
        Reflect.getMetadata(AUTH_CAPABILITIES_KEY, controller[handler]),
      ).toEqual([AuthCapability.PLATFORM_ORGANIZATION_REVIEW]);
    },
  );

  it('should scope laboratory administrator operations to the current user', async () => {
    const user = {
      id: 'user-id',
      email: 'admin@laboratory.test',
    };
    service.listMyDocuments.mockResolvedValue({ documents: [] });

    await controller.listMyDocuments(user);

    expect(service.listMyDocuments).toHaveBeenCalledWith(user.id);
  });

  it('should pass the requested laboratory to platform administrator operations', async () => {
    service.createAdminDocumentDownloadUrl.mockResolvedValue({
      url: 'https://signed-url.test/document',
      expires_in_seconds: 300,
    });

    await controller.downloadLaboratoryDocument(
      'laboratory-id',
      LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    );

    expect(service.createAdminDocumentDownloadUrl).toHaveBeenCalledWith(
      'laboratory-id',
      LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    );
  });
});
