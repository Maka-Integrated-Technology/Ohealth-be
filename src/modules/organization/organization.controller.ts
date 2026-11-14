import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { IAuthUser, IMulterFile } from '../../common/types';
import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ORGANIZATION_DOCUMENT_UPLOAD_OPTIONS } from './constants/organization-upload.constant';
import {
  DeleteOrganizationDocumentDocs,
  DownloadOrganizationDocumentDocs,
  GetOrganizationStatusDocs,
  ListOrganizationApplicationsDocs,
  ListOrganizationDocumentsDocs,
  ListOrganizationStatusHistoryDocs,
  SetupOrganizationDocs,
  SubmitOrganizationDocs,
  TransitionOrganizationDocs,
  UploadOrganizationDocumentDocs,
} from './docs';
import { SetupOrganizationDto } from './dto/organization-setup.dto';
import {
  OrganizationReviewQueryDto,
  RejectOrganizationDto,
} from './dto/organization-verification.dto';
import { OrganizationDocumentType } from './enums/organization-document-type.enum';
import { OrganizationDocumentsService } from './organization-documents.service';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { OrganizationVerificationService } from './organization-verification.service';

@ApiTags('Organization Onboarding')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Organization-Id',
  required: false,
  description: 'Required on organization-scoped self-service routes',
})
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
@Controller('organizations/onboarding')
export class OrganizationController {
  constructor(
    private readonly onboardingService: OrganizationOnboardingService,
    private readonly documentsService: OrganizationDocumentsService,
    private readonly verificationService: OrganizationVerificationService,
  ) {}

  @Post('admin-setup')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @SetupOrganizationDocs()
  setup(@Body() dto: SetupOrganizationDto) {
    return this.onboardingService.setupAdministrator(dto);
  }

  @Post('me/documents/:documentType')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @UseInterceptors(
    FileInterceptor('file', ORGANIZATION_DOCUMENT_UPLOAD_OPTIONS),
  )
  @HttpCode(HttpStatus.OK)
  @UploadOrganizationDocumentDocs()
  uploadMine(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
    @UploadedFile() file: IMulterFile,
  ) {
    return this.documentsService.uploadMine(
      user.id,
      organizationId,
      documentType,
      file,
    );
  }

  @Get('me/documents')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @ListOrganizationDocumentsDocs()
  listMine(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.documentsService.listMine(user.id, organizationId);
  }

  @Get('me/documents/:documentType/download')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @DownloadOrganizationDocumentDocs()
  downloadMine(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
  ) {
    return this.documentsService.downloadMine(
      user.id,
      organizationId,
      documentType,
    );
  }

  @Delete('me/documents/:documentType')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @DeleteOrganizationDocumentDocs()
  deleteMine(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
  ) {
    return this.documentsService.deleteMine(
      user.id,
      organizationId,
      documentType,
    );
  }

  @Get('me/status')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @GetOrganizationStatusDocs()
  getMyStatus(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.verificationService.getMine(user.id, organizationId);
  }

  @Post('me/submit')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @HttpCode(HttpStatus.OK)
  @SubmitOrganizationDocs()
  submitMine(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.verificationService.submitMine(user.id, organizationId);
  }

  @Get('review/applications')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @ListOrganizationApplicationsDocs()
  listApplications(@Query() query: OrganizationReviewQueryDto) {
    return this.verificationService.listApplications(query);
  }

  @Get(':organizationId/documents')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @ListOrganizationDocumentsDocs()
  listForReview(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.documentsService.listForReview(organizationId);
  }

  @Get(':organizationId/documents/:documentType/download')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @DownloadOrganizationDocumentDocs()
  downloadForReview(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
  ) {
    return this.documentsService.downloadForReview(
      organizationId,
      documentType,
    );
  }

  @Get(':organizationId/status')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @GetOrganizationStatusDocs()
  getStatus(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.verificationService.getForReview(organizationId);
  }

  @Get(':organizationId/status/history')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @ListOrganizationStatusHistoryDocs()
  listHistory(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.verificationService.listHistory(organizationId);
  }

  @Post(':organizationId/status/under-review')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.OK)
  @TransitionOrganizationDocs('Mark organization under review')
  markUnderReview(
    @CurrentUser() user: IAuthUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.verificationService.markUnderReview(organizationId, user.id);
  }

  @Post(':organizationId/status/approve')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.OK)
  @TransitionOrganizationDocs('Approve organization')
  approve(
    @CurrentUser() user: IAuthUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.verificationService.approve(organizationId, user.id);
  }

  @Post(':organizationId/status/reject')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.OK)
  @TransitionOrganizationDocs('Reject organization')
  reject(
    @CurrentUser() user: IAuthUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: RejectOrganizationDto,
  ) {
    return this.verificationService.reject(organizationId, user.id, dto);
  }
}
