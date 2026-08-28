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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { IMulterFile, IRequestWithUser } from '../../common/types';
import {
  ALLOWED_PROFESSIONAL_VERIFICATION_DOCUMENT_MIME_TYPES,
  MAX_PROFESSIONAL_VERIFICATION_DOCUMENT_SIZE,
} from '../../constants/file-upload.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

import {
  ProfessionalVerificationDocumentDownloadDto,
  ProfessionalVerificationDocumentResponseDto,
  ProfessionalVerificationDocumentsStatusDto,
} from './dto/professional-verification-document-response.dto';
import { ProfessionalVerificationDocumentType } from './enums/professional-verification-document-type.enum';
import { ProfessionalVerificationDocumentsService } from './professional-verification-documents.service';

const PROFESSIONAL_ACCESS_ROLES = [
  UserRole.DOCTOR,
  UserRole.THERAPIST,
  UserRole.COUNSELLOR,
  UserRole.LAB_PROFESSIONAL,
];

const professionalVerificationDocumentUploadOptions = {
  limits: { fileSize: MAX_PROFESSIONAL_VERIFICATION_DOCUMENT_SIZE },
  fileFilter: (
    _request: unknown,
    file: IMulterFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (
      !ALLOWED_PROFESSIONAL_VERIFICATION_DOCUMENT_MIME_TYPES.includes(
        file.mimetype,
      )
    ) {
      callback(
        new BadRequestException('unsupported verification document type'),
        false,
      );
      return;
    }

    callback(null, true);
  },
};

@ApiTags('Professional Verification Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('professionals')
export class ProfessionalVerificationDocumentsController {
  constructor(
    private readonly verificationDocumentsService: ProfessionalVerificationDocumentsService,
  ) {}

  @Post('me/verification-documents/:documentType')
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @UseInterceptors(
    FileInterceptor('file', professionalVerificationDocumentUploadOptions),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a professional verification document' })
  @ApiParam({
    name: 'documentType',
    enum: ProfessionalVerificationDocumentType,
  })
  @ApiResponse({
    status: 200,
    type: ProfessionalVerificationDocumentResponseDto,
  })
  uploadMyDocument(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param(
      'documentType',
      new ParseEnumPipe(ProfessionalVerificationDocumentType),
    )
    documentType: ProfessionalVerificationDocumentType,
    @UploadedFile() file: IMulterFile,
  ): Promise<ProfessionalVerificationDocumentResponseDto> {
    return this.verificationDocumentsService.uploadMyDocument(
      user.id,
      documentType,
      file,
    );
  }

  @Get('me/verification-documents')
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({
    summary: 'List the current professional’s verification documents',
  })
  @ApiResponse({
    status: 200,
    type: ProfessionalVerificationDocumentsStatusDto,
  })
  listMyDocuments(
    @CurrentUser() user: IRequestWithUser['user'],
  ): Promise<ProfessionalVerificationDocumentsStatusDto> {
    return this.verificationDocumentsService.listMyDocuments(user.id);
  }

  @Get('me/verification-documents/:documentType/download')
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Get a signed download URL for a document' })
  @ApiParam({
    name: 'documentType',
    enum: ProfessionalVerificationDocumentType,
  })
  @ApiResponse({
    status: 200,
    type: ProfessionalVerificationDocumentDownloadDto,
  })
  downloadMyDocument(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param(
      'documentType',
      new ParseEnumPipe(ProfessionalVerificationDocumentType),
    )
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<ProfessionalVerificationDocumentDownloadDto> {
    return this.verificationDocumentsService.createMyDocumentDownloadUrl(
      user.id,
      documentType,
    );
  }

  @Delete('me/verification-documents/:documentType')
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Delete an uploaded verification document' })
  @ApiParam({
    name: 'documentType',
    enum: ProfessionalVerificationDocumentType,
  })
  deleteMyDocument(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param(
      'documentType',
      new ParseEnumPipe(ProfessionalVerificationDocumentType),
    )
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<{ message: string }> {
    return this.verificationDocumentsService.deleteMyDocument(
      user.id,
      documentType,
    );
  }

  @Get(':professionalId/verification-documents')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List a professional’s verification documents (admin only)',
  })
  @ApiParam({ name: 'professionalId', description: 'Professional UUID' })
  @ApiResponse({
    status: 200,
    type: ProfessionalVerificationDocumentsStatusDto,
  })
  listProfessionalDocuments(
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
  ): Promise<ProfessionalVerificationDocumentsStatusDto> {
    return this.verificationDocumentsService.listDocumentsForProfessional(
      professionalId,
    );
  }

  @Get(':professionalId/verification-documents/:documentType/download')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a signed download URL for a document (admin only)',
  })
  @ApiParam({ name: 'professionalId', description: 'Professional UUID' })
  @ApiParam({
    name: 'documentType',
    enum: ProfessionalVerificationDocumentType,
  })
  @ApiResponse({
    status: 200,
    type: ProfessionalVerificationDocumentDownloadDto,
  })
  downloadProfessionalDocument(
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
    @Param(
      'documentType',
      new ParseEnumPipe(ProfessionalVerificationDocumentType),
    )
    documentType: ProfessionalVerificationDocumentType,
  ): Promise<ProfessionalVerificationDocumentDownloadDto> {
    return this.verificationDocumentsService.createAdminDocumentDownloadUrl(
      professionalId,
      documentType,
    );
  }
}
