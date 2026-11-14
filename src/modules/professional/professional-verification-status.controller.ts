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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { IRequestWithUser } from '../../common/types';
import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  ProfessionalVerificationStatusHistoryResponseDto,
  ProfessionalVerificationStatusResponseDto,
  RejectProfessionalVerificationDto,
} from './dto/professional-verification-status-response.dto';
import { ProfessionalVerificationStatusService } from './professional-verification-status.service';

@ApiTags('Professional Verification Status')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
@Controller('professionals')
export class ProfessionalVerificationStatusController {
  constructor(
    private readonly verificationStatusService: ProfessionalVerificationStatusService,
  ) {}

  @Get('me/verification-status')
  @RequireCapabilities(AuthCapability.PROFESSIONAL_VERIFICATION)
  @ApiOperation({
    summary: 'Get the current professional’s verification status',
  })
  @ApiResponse({ status: 200, type: ProfessionalVerificationStatusResponseDto })
  getMyStatus(
    @CurrentUser() user: IRequestWithUser['user'],
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    return this.verificationStatusService.getMyStatus(user.id);
  }

  @Post(':professionalId/verify')
  @RequireCapabilities(AuthCapability.PLATFORM_PROFESSIONAL_REVIEW)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a professional’s credentials (admin only)',
  })
  @ApiParam({ name: 'professionalId', description: 'Professional UUID' })
  @ApiResponse({ status: 200, type: ProfessionalVerificationStatusResponseDto })
  verify(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    return this.verificationStatusService.verify(professionalId, user.id);
  }

  @Post(':professionalId/reject')
  @RequireCapabilities(AuthCapability.PLATFORM_PROFESSIONAL_REVIEW)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a professional’s credentials (admin only)' })
  @ApiParam({ name: 'professionalId', description: 'Professional UUID' })
  @ApiResponse({ status: 200, type: ProfessionalVerificationStatusResponseDto })
  reject(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
    @Body() dto: RejectProfessionalVerificationDto,
  ): Promise<ProfessionalVerificationStatusResponseDto> {
    return this.verificationStatusService.reject(
      professionalId,
      user.id,
      dto.reason,
    );
  }

  @Get(':professionalId/verification-status/history')
  @RequireCapabilities(AuthCapability.PLATFORM_PROFESSIONAL_REVIEW)
  @ApiOperation({ summary: 'List verification status history (admin only)' })
  @ApiParam({ name: 'professionalId', description: 'Professional UUID' })
  @ApiResponse({
    status: 200,
    type: [ProfessionalVerificationStatusHistoryResponseDto],
  })
  listHistory(
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
  ): Promise<ProfessionalVerificationStatusHistoryResponseDto[]> {
    return this.verificationStatusService.listHistory(professionalId);
  }
}
