import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  ApproveLaboratoryVerificationDocs,
  GetLaboratoryVerificationStatusForAdminDocs,
  GetMyLaboratoryVerificationStatusDocs,
  ListLaboratoryVerificationStatusHistoryDocs,
  MarkLaboratoryVerificationUnderReviewDocs,
  RejectLaboratoryVerificationDocs,
  SubmitMyLaboratoryVerificationDocs,
} from './docs';
import {
  LaboratoryVerificationStatusHistoryResponseDto,
  LaboratoryVerificationStatusResponseDto,
  RejectLaboratoryVerificationDto,
} from './dto/laboratory-verification-status.dto';
import { LaboratoryVerificationStatusService } from './laboratory-verification-status.service';

interface ICurrentUser {
  id: string;
  email: string;
}

@ApiTags('Laboratory Verification Status')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Organization-Id',
  required: false,
  description: 'Required on laboratory self-service routes',
})
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
@Controller('laboratories')
export class LaboratoryVerificationStatusController {
  constructor(
    private readonly verificationStatusService: LaboratoryVerificationStatusService,
  ) {}

  @Get('me/verification-status')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @GetMyLaboratoryVerificationStatusDocs()
  getMyStatus(
    @CurrentUser() user: ICurrentUser,
    @Headers('x-organization-id') laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.getMyStatus(user.id, laboratoryId);
  }

  @Post('me/verification-status/submit')
  @RequireCapabilities(AuthCapability.ORGANIZATION_ONBOARDING)
  @HttpCode(HttpStatus.OK)
  @SubmitMyLaboratoryVerificationDocs()
  submitMyVerification(
    @CurrentUser() user: ICurrentUser,
    @Headers('x-organization-id') laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.submitMyVerification(
      user.id,
      laboratoryId,
    );
  }

  @Get(':laboratoryId/verification-status')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @GetLaboratoryVerificationStatusForAdminDocs()
  getLaboratoryStatus(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.getStatusForLaboratory(laboratoryId);
  }

  @Get(':laboratoryId/verification-status/history')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @ListLaboratoryVerificationStatusHistoryDocs()
  listHistory(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusHistoryResponseDto[]> {
    return this.verificationStatusService.listHistory(laboratoryId);
  }

  @Post(':laboratoryId/verification-status/under-review')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.OK)
  @MarkLaboratoryVerificationUnderReviewDocs()
  markUnderReview(
    @CurrentUser() user: ICurrentUser,
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.markUnderReview(
      laboratoryId,
      user.id,
    );
  }

  @Post(':laboratoryId/verification-status/approve')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.OK)
  @ApproveLaboratoryVerificationDocs()
  approve(
    @CurrentUser() user: ICurrentUser,
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.approve(laboratoryId, user.id);
  }

  @Post(':laboratoryId/verification-status/reject')
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.OK)
  @RejectLaboratoryVerificationDocs()
  reject(
    @CurrentUser() user: ICurrentUser,
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
    @Body() dto: RejectLaboratoryVerificationDto,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.reject(laboratoryId, user.id, dto);
  }
}
