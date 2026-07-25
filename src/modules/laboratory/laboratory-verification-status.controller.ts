import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

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
  roles: UserRole[];
}

@ApiTags('Laboratory Verification Status')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laboratories')
export class LaboratoryVerificationStatusController {
  constructor(
    private readonly verificationStatusService: LaboratoryVerificationStatusService,
  ) {}

  @Get('me/verification-status')
  @Roles(UserRole.LAB_ADMIN)
  @GetMyLaboratoryVerificationStatusDocs()
  getMyStatus(
    @CurrentUser() user: ICurrentUser,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.getMyStatus(user.id);
  }

  @Post('me/verification-status/submit')
  @Roles(UserRole.LAB_ADMIN)
  @HttpCode(HttpStatus.OK)
  @SubmitMyLaboratoryVerificationDocs()
  submitMyVerification(
    @CurrentUser() user: ICurrentUser,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.submitMyVerification(user.id);
  }

  @Get(':laboratoryId/verification-status')
  @Roles(UserRole.ADMIN)
  @GetLaboratoryVerificationStatusForAdminDocs()
  getLaboratoryStatus(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.getStatusForLaboratory(laboratoryId);
  }

  @Get(':laboratoryId/verification-status/history')
  @Roles(UserRole.ADMIN)
  @ListLaboratoryVerificationStatusHistoryDocs()
  listHistory(
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusHistoryResponseDto[]> {
    return this.verificationStatusService.listHistory(laboratoryId);
  }

  @Post(':laboratoryId/verification-status/under-review')
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApproveLaboratoryVerificationDocs()
  approve(
    @CurrentUser() user: ICurrentUser,
    @Param('laboratoryId', ParseUUIDPipe) laboratoryId: string,
  ): Promise<LaboratoryVerificationStatusResponseDto> {
    return this.verificationStatusService.approve(laboratoryId, user.id);
  }

  @Post(':laboratoryId/verification-status/reject')
  @Roles(UserRole.ADMIN)
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
