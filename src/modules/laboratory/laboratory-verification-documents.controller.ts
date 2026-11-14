import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { IMulterFile } from '../../common/types';
import {
  ALLOWED_LAB_VERIFICATION_DOCUMENT_MIME_TYPES,
  MAX_LAB_VERIFICATION_DOCUMENT_SIZE,
} from '../../constants/file-upload.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  DeleteMyLaboratoryVerificationDocumentDocs,
  DownloadLaboratoryVerificationDocumentForAdminDocs,
  DownloadMyLaboratoryVerificationDocumentDocs,
  ListLaboratoryVerificationDocumentsForAdminDocs,
  ListMyLaboratoryVerificationDocumentsDocs,
  UploadLaboratoryVerificationDocumentDocs,
} from './docs';
import {
  LaboratoryVerificationDocumentDownloadDto,
  LaboratoryVerificationDocumentResponseDto,
  LaboratoryVerificationDocumentsStatusDto,
} from './dto/laboratory-verification-document-response.dto';
import { LaboratoryVerificationDocumentType } from './enums/laboratory-verification-document-type.enum';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';

interface ICurrentUser {
  id: string;
  email: string;
}

const laboratoryVerificationDocumentUploadOptions = {
  limits: { fileSize: MAX_LAB_VERIFICATION_DOCUMENT_SIZE },
  fileFilter: (
    _request: unknown,
    file: IMulterFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_LAB_VERIFICATION_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new BadRequestException('unsupported verification document type'),
        false,
      );
      return;
    }

    callback(null, true);
  },
};

@ApiTags('Laboratory Verification Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
@Controller('laboratories')
export class LaboratoryVerificationDocumentsController {
  constructor(
    private readonly verificationDocumentsService: LaboratoryVerificationDocumentsService,
  ) {}

  @Post('me/verification-documents/:documentType')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @UseInterceptors(
    FileInterceptor('file', laboratoryVerificationDocumentUploadOptions),
  )
  @HttpCode(HttpStatus.OK)
  @UploadLaboratoryVerificationDocumentDocs()
  uploadMyDocument(
    @CurrentUser() user: ICurrentUser,
    @Param(
      'documentType',
      new ParseEnumPipe(LaboratoryVerificationDocumentType),
    )
    documentType: LaboratoryVerificationDocumentType,
    @UploadedFile() file: IMulterFile,
  ): Promise<LaboratoryVerificationDocumentResponseDto> {
    return this.verificationDocumentsService.uploadMyDocument(
      user.id,
      documentType,
      file,
    );
  }

  @Get('me/verification-documents')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @ListMyLaboratoryVerificationDocumentsDocs()
  listMyDocuments(
    @CurrentUser() user: ICurrentUser,
  ): Promise<LaboratoryVerificationDocumentsStatusDto> {
    return this.verificationDocumentsService.listMyDocuments(user.id);
  }

  @Get('me/verification-documents/:documentType/download')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @DownloadMyLaboratoryVerificationDocumentDocs()
  downloadMyDocument(
    @CurrentUser() user: ICurrentUser,
    @Param(
      'documentType',
      new ParseEnumPipe(LaboratoryVerificationDocumentType),
    )
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<LaboratoryVerificationDocumentDownloadDto> {
    return this.verificationDocumentsService.createMyDocumentDownloadUrl(
      user.id,
      documentType,
    );
  }

  @Delete('me/verification-documents/:documentType')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @DeleteMyLaboratoryVerificationDocumentDocs()
  deleteMyDocument(
    @CurrentUser() user: ICurrentUser,
    @Param(
      'documentType',
      new ParseEnumPipe(LaboratoryVerificationDocumentType),
    )
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<{ message: string }> {
    return this.verificationDocumentsService.deleteMyDocument(
      user.id,
      documentType,
    );
  }

  @Get(':laboratoryId/verification-documents')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @ListLaboratoryVerificationDocumentsForAdminDocs()
  listLaboratoryDocuments(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationDocumentsStatusDto> {
    return this.verificationDocumentsService.listDocumentsForLaboratory(
      laboratoryId,
    );
  }

  @Get(':laboratoryId/verification-documents/:documentType/download')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @DownloadLaboratoryVerificationDocumentForAdminDocs()
  downloadLaboratoryDocument(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
    @Param(
      'documentType',
      new ParseEnumPipe(LaboratoryVerificationDocumentType),
    )
    documentType: LaboratoryVerificationDocumentType,
  ): Promise<LaboratoryVerificationDocumentDownloadDto> {
    return this.verificationDocumentsService.createAdminDocumentDownloadUrl(
      laboratoryId,
      documentType,
    );
  }
}
