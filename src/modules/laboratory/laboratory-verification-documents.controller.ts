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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

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
  roles: UserRole[];
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laboratories')
export class LaboratoryVerificationDocumentsController {
  constructor(
    private readonly verificationDocumentsService: LaboratoryVerificationDocumentsService,
  ) {}

  @Post('me/verification-documents/:documentType')
  @Roles(UserRole.LAB_ADMIN)
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
  @Roles(UserRole.LAB_ADMIN)
  @ListMyLaboratoryVerificationDocumentsDocs()
  listMyDocuments(
    @CurrentUser() user: ICurrentUser,
  ): Promise<LaboratoryVerificationDocumentsStatusDto> {
    return this.verificationDocumentsService.listMyDocuments(user.id);
  }

  @Get('me/verification-documents/:documentType/download')
  @Roles(UserRole.LAB_ADMIN)
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
  @Roles(UserRole.LAB_ADMIN)
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
  @Roles(UserRole.ADMIN)
  @ListLaboratoryVerificationDocumentsForAdminDocs()
  listLaboratoryDocuments(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationDocumentsStatusDto> {
    return this.verificationDocumentsService.listDocumentsForLaboratory(
      laboratoryId,
    );
  }

  @Get(':laboratoryId/verification-documents/:documentType/download')
  @Roles(UserRole.ADMIN)
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
