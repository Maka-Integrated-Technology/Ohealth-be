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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

import {
  ProfessionalVerificationStatusHistoryResponseDto,
  ProfessionalVerificationStatusResponseDto,
  RejectProfessionalVerificationDto,
} from './dto/professional-verification-status-response.dto';
import { ProfessionalVerificationStatusService } from './professional-verification-status.service';

const PROFESSIONAL_ACCESS_ROLES = [
  UserRole.DOCTOR,
  UserRole.THERAPIST,
  UserRole.COUNSELLOR,
  UserRole.LAB_PROFESSIONAL,
];

@ApiTags('Professional Verification Status')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('professionals')
export class ProfessionalVerificationStatusController {
  constructor(
    private readonly verificationStatusService: ProfessionalVerificationStatusService,
  ) {}

  @Get('me/verification-status')
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
