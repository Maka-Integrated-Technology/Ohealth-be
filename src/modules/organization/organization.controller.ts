import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { IAuthUser, IMulterFile } from '../../common/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

import { ORGANIZATION_ADMIN_ROLES } from './constants/organization-role.constant';
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations/onboarding')
export class OrganizationController {
  constructor(
    private readonly onboardingService: OrganizationOnboardingService,
    private readonly documentsService: OrganizationDocumentsService,
    private readonly verificationService: OrganizationVerificationService,
  ) {}

  @Post('admin-setup')
  @Roles(UserRole.ADMIN)
  @SetupOrganizationDocs()
  setup(@Body() dto: SetupOrganizationDto) {
    return this.onboardingService.setupAdministrator(dto);
  }

  @Post('me/documents/:documentType')
  @Roles(...ORGANIZATION_ADMIN_ROLES)
  @UseInterceptors(
    FileInterceptor('file', ORGANIZATION_DOCUMENT_UPLOAD_OPTIONS),
  )
  @HttpCode(HttpStatus.OK)
  @UploadOrganizationDocumentDocs()
  uploadMine(
    @CurrentUser() user: IAuthUser,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
    @UploadedFile() file: IMulterFile,
  ) {
    return this.documentsService.uploadMine(user.id, documentType, file);
  }

  @Get('me/documents')
  @Roles(...ORGANIZATION_ADMIN_ROLES)
  @ListOrganizationDocumentsDocs()
  listMine(@CurrentUser() user: IAuthUser) {
    return this.documentsService.listMine(user.id);
  }

  @Get('me/documents/:documentType/download')
  @Roles(...ORGANIZATION_ADMIN_ROLES)
  @DownloadOrganizationDocumentDocs()
  downloadMine(
    @CurrentUser() user: IAuthUser,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
  ) {
    return this.documentsService.downloadMine(user.id, documentType);
  }

  @Delete('me/documents/:documentType')
  @Roles(...ORGANIZATION_ADMIN_ROLES)
  @DeleteOrganizationDocumentDocs()
  deleteMine(
    @CurrentUser() user: IAuthUser,
    @Param('documentType', new ParseEnumPipe(OrganizationDocumentType))
    documentType: OrganizationDocumentType,
  ) {
    return this.documentsService.deleteMine(user.id, documentType);
  }

  @Get('me/status')
  @Roles(...ORGANIZATION_ADMIN_ROLES)
  @GetOrganizationStatusDocs()
  getMyStatus(@CurrentUser() user: IAuthUser) {
    return this.verificationService.getMine(user.id);
  }

  @Post('me/submit')
  @Roles(...ORGANIZATION_ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @SubmitOrganizationDocs()
  submitMine(@CurrentUser() user: IAuthUser) {
    return this.verificationService.submitMine(user.id);
  }

  @Get('review/applications')
  @Roles(UserRole.ADMIN)
  @ListOrganizationApplicationsDocs()
  listApplications(@Query() query: OrganizationReviewQueryDto) {
    return this.verificationService.listApplications(query);
  }

  @Get(':organizationId/documents')
  @Roles(UserRole.ADMIN)
  @ListOrganizationDocumentsDocs()
  listForReview(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.documentsService.listForReview(organizationId);
  }

  @Get(':organizationId/documents/:documentType/download')
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  @GetOrganizationStatusDocs()
  getStatus(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.verificationService.getForReview(organizationId);
  }

  @Get(':organizationId/status/history')
  @Roles(UserRole.ADMIN)
  @ListOrganizationStatusHistoryDocs()
  listHistory(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.verificationService.listHistory(organizationId);
  }

  @Post(':organizationId/status/under-review')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @TransitionOrganizationDocs('Mark organization under review')
  markUnderReview(
    @CurrentUser() user: IAuthUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.verificationService.markUnderReview(organizationId, user.id);
  }

  @Post(':organizationId/status/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @TransitionOrganizationDocs('Approve organization')
  approve(
    @CurrentUser() user: IAuthUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.verificationService.approve(organizationId, user.id);
  }

  @Post(':organizationId/status/reject')
  @Roles(UserRole.ADMIN)
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
