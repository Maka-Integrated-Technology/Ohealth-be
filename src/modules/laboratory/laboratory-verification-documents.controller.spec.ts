import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

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

  it('should protect every endpoint with JWT and role guards', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      LaboratoryVerificationDocumentsController,
    );

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it.each([
    'uploadMyDocument',
    'listMyDocuments',
    'downloadMyDocument',
    'deleteMyDocument',
  ] as const)('should restrict %s to laboratory administrators', (handler) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller[handler])).toEqual([
      UserRole.LAB_ADMIN,
    ]);
  });

  it.each(['listLaboratoryDocuments', 'downloadLaboratoryDocument'] as const)(
    'should restrict %s to platform administrators',
    (handler) => {
      expect(Reflect.getMetadata(ROLES_KEY, controller[handler])).toEqual([
        UserRole.ADMIN,
      ]);
    },
  );

  it('should scope laboratory administrator operations to the current user', async () => {
    const user = {
      id: 'user-id',
      email: 'admin@laboratory.test',
      roles: [UserRole.LAB_ADMIN],
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
