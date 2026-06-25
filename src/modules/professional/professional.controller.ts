import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { IRequestWithUser } from '../../common/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { BulkCreateAvailabilityDto } from './dto/create-professional-availability.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ProfessionalDetailResponseDto,
  ProfessionalResponseDto,
} from './dto/professional-response.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalService } from './professional.service';

@ApiTags('Professionals')
@Controller('professionals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfessionalController {
  constructor(private readonly professionalService: ProfessionalService) {}

  @Get()
  @ApiOperation({ summary: 'Get professionals by speciality' })
  @ApiQuery({
    name: 'speciality_id',
    required: true,
    description: 'Speciality UUID',
  })
  @ApiResponse({ status: 200, type: [ProfessionalResponseDto] })
  findBySpeciality(
    @Query('speciality_id') specialityId: string,
  ): Promise<ProfessionalResponseDto[]> {
    return this.professionalService.findBySpeciality(specialityId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get professional details with grouped availability',
  })
  @ApiParam({ name: 'id', description: 'Professional UUID' })
  @ApiResponse({ status: 200, type: ProfessionalDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  findOne(@Param('id') id: string): Promise<ProfessionalDetailResponseDto> {
    return this.professionalService.findOne(id);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get all reviews for a professional' })
  @ApiParam({ name: 'id', description: 'Professional UUID' })
  @ApiResponse({ status: 200, type: [ReviewResponseDto] })
  getReviews(@Param('id') id: string): Promise<ReviewResponseDto[]> {
    return this.professionalService.getReviews(id);
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for a professional' })
  @ApiParam({ name: 'id', description: 'Professional UUID' })
  @ApiResponse({ status: 201, type: ReviewResponseDto })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  @ApiResponse({
    status: 409,
    description: 'Review already submitted for this booking',
  })
  createReview(
    @Param('id') id: string,
    @CurrentUser() user: IRequestWithUser['user'],
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.professionalService.createReview(id, user.id, dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a professional profile (admin only)' })
  @ApiResponse({ status: 201, type: ProfessionalResponseDto })
  @ApiResponse({
    status: 400,
    description: 'User does not have a valid professional role',
  })
  @ApiResponse({ status: 404, description: 'User or speciality not found' })
  @ApiResponse({
    status: 409,
    description: 'Professional profile already exists for user',
  })
  createProfessional(
    @Body() dto: CreateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    return this.professionalService.createProfessional(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a professional profile (admin only)' })
  @ApiParam({ name: 'id', description: 'Professional UUID' })
  @ApiResponse({ status: 200, type: ProfessionalResponseDto })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  updateProfessional(
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    return this.professionalService.updateProfessional(id, dto);
  }

  @Post(':id/availabilities')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add availability slots for a professional (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Professional UUID' })
  @ApiResponse({
    status: 201,
    description:
      'Slots created. Returns array of created ProfessionalAvailability records.',
  })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  @ApiResponse({ status: 409, description: 'One or more slots already exist' })
  createAvailabilities(
    @Param('id') id: string,
    @Body() dto: BulkCreateAvailabilityDto,
  ): Promise<ProfessionalAvailability[]> {
    return this.professionalService.createAvailabilities(id, dto);
  }
}
