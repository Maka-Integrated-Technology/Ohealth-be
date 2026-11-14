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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ApiMessageResponseDto } from '../../common/dto/response.dto';
import { IMulterFile, IRequestWithUser } from '../../common/types';
import {
  ALLOWED_PROFESSIONAL_VERIFICATION_DOCUMENT_MIME_TYPES,
  MAX_PROFESSIONAL_VERIFICATION_DOCUMENT_SIZE,
} from '../../constants/file-upload.constants';
import { createFileUploadSchema } from '../../openapi/openapi-upload-schema';
import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  ProfessionalVerificationDocumentDownloadDto,
  ProfessionalVerificationDocumentResponseDto,
  ProfessionalVerificationDocumentsStatusDto,
} from './dto/professional-verification-document-response.dto';
import { ProfessionalVerificationDocumentType } from './enums/professional-verification-document-type.enum';
import { ProfessionalVerificationDocumentsService } from './professional-verification-documents.service';

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
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
@Controller('professionals')
export class ProfessionalVerificationDocumentsController {
  constructor(
    private readonly verificationDocumentsService: ProfessionalVerificationDocumentsService,
  ) {}

  @Post('me/verification-documents/:documentType')
  @RequireCapabilities(AuthCapability.PROFESSIONAL_VERIFICATION)
  @UseInterceptors(
    FileInterceptor('file', professionalVerificationDocumentUploadOptions),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a professional verification document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: createFileUploadSchema({
      allowedMimeTypes: ALLOWED_PROFESSIONAL_VERIFICATION_DOCUMENT_MIME_TYPES,
      maxSizeBytes: MAX_PROFESSIONAL_VERIFICATION_DOCUMENT_SIZE,
    }),
  })
  @ApiParam({
    name: 'documentType',
    enum: ProfessionalVerificationDocumentType,
  })
  @ApiResponse({
    status: 200,
    type: ProfessionalVerificationDocumentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid document type or file' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds size limit' })
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
  @RequireCapabilities(AuthCapability.PROFESSIONAL_VERIFICATION)
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
  @RequireCapabilities(AuthCapability.PROFESSIONAL_VERIFICATION)
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
  @RequireCapabilities(AuthCapability.PROFESSIONAL_VERIFICATION)
  @ApiOperation({ summary: 'Delete an uploaded verification document' })
  @ApiResponse({ status: 200, type: ApiMessageResponseDto })
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
  @RequireCapabilities(AuthCapability.PLATFORM_PROFESSIONAL_REVIEW)
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
  @RequireCapabilities(AuthCapability.PLATFORM_PROFESSIONAL_REVIEW)
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
