import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
import { UserRole } from '../user/enums/user-role.enum';

import { BulkCreateAvailabilityDto } from './dto/create-professional-availability.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProfessionalAvailabilityResponseDto } from './dto/professional-availability-response.dto';
import {
  ProfessionalAppointmentResponseDto,
  ProfessionalDashboardResponseDto,
} from './dto/professional-dashboard-response.dto';
import { ProfessionalMeResponseDto } from './dto/professional-me-response.dto';
import {
  CreateProfessionalPatientNoteDto,
  UpdateProfessionalPatientNoteDto,
} from './dto/professional-patient-note.dto';
import {
  ProfessionalPatientConsultationsResponseDto,
  ProfessionalPatientDetailResponseDto,
  ProfessionalPatientNoteResponseDto,
  ProfessionalPatientNotesResponseDto,
  ProfessionalPatientRecordsResponseDto,
  ProfessionalPatientSortBy,
} from './dto/professional-patient-response.dto';
import {
  ProfessionalDetailResponseDto,
  ProfessionalResponseDto,
} from './dto/professional-response.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { UpsertProfessionalProfileDto } from './dto/upsert-professional-profile.dto';
import { ProfessionalService } from './professional.service';

const PROFESSIONAL_ACCESS_ROLES = [
  UserRole.DOCTOR,
  UserRole.THERAPIST,
  UserRole.COUNSELLOR,
  UserRole.LAB_PROFESSIONAL,
];

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

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Get current professional onboarding profile' })
  @ApiResponse({ status: 200, type: ProfessionalMeResponseDto })
  findMe(
    @CurrentUser() user: IRequestWithUser['user'],
  ): Promise<ProfessionalMeResponseDto> {
    return this.professionalService.findMe(user.id);
  }

  @Put('me/profile')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({
    summary: 'Create or update current professional practice profile',
  })
  @ApiResponse({ status: 200, type: ProfessionalMeResponseDto })
  upsertMeProfile(
    @CurrentUser() user: IRequestWithUser['user'],
    @Body() dto: UpsertProfessionalProfileDto,
  ): Promise<ProfessionalMeResponseDto> {
    return this.professionalService.upsertMeProfile(user.id, dto);
  }

  @Post('me/availabilities')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add availability slots for current professional' })
  @ApiResponse({
    status: 201,
    description: 'Slots created.',
    type: [ProfessionalAvailabilityResponseDto],
  })
  createMyAvailabilities(
    @CurrentUser() user: IRequestWithUser['user'],
    @Body() dto: BulkCreateAvailabilityDto,
  ): Promise<ProfessionalAvailabilityResponseDto[]> {
    return this.professionalService.createMyAvailabilities(user.id, dto);
  }

  @Get('me/dashboard')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Get current professional dashboard data' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Dashboard date in YYYY-MM-DD format. Defaults to today.',
  })
  @ApiResponse({ status: 200, type: ProfessionalDashboardResponseDto })
  getMyDashboard(
    @CurrentUser() user: IRequestWithUser['user'],
    @Query('date') date?: string,
  ): Promise<ProfessionalDashboardResponseDto> {
    return this.professionalService.getMyDashboard(user.id, date);
  }

  @Get('me/patients')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Search and list current professional patients' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by patient name, ID, email, phone, or condition.',
  })
  @ApiQuery({
    name: 'condition',
    required: false,
    description: 'Filter patients by condition text.',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    enum: ProfessionalPatientSortBy,
    description: 'Sort patients by a table column.',
  })
  @ApiQuery({
    name: 'sort_order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number. Defaults to 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      'Records per page. Defaults to 9 to match the dashboard table.',
  })
  @ApiResponse({ status: 200, type: ProfessionalPatientRecordsResponseDto })
  getMyPatients(
    @CurrentUser() user: IRequestWithUser['user'],
    @Query('search') search?: string,
    @Query('condition') condition?: string,
    @Query('sort_by') sortBy?: ProfessionalPatientSortBy,
    @Query('sort_order') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ProfessionalPatientRecordsResponseDto> {
    return this.professionalService.getMyPatients(user.id, {
      search,
      condition,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      limit,
    });
  }

  @Get('me/patients/:patientId')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({
    summary: 'Get one patient profile with consultation history',
  })
  @ApiParam({ name: 'patientId', description: 'Patient user UUID' })
  @ApiResponse({ status: 200, type: ProfessionalPatientDetailResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Patient not found for this professional',
  })
  getMyPatientProfile(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('patientId') patientId: string,
  ): Promise<ProfessionalPatientDetailResponseDto> {
    return this.professionalService.getMyPatientProfile(user.id, patientId);
  }

  @Get('me/patients/:patientId/consultations')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'List one patient consultation history' })
  @ApiParam({ name: 'patientId', description: 'Patient user UUID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number. Defaults to 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Records per page. Defaults to 100 for the full history view.',
  })
  @ApiResponse({
    status: 200,
    type: ProfessionalPatientConsultationsResponseDto,
  })
  getMyPatientConsultations(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('patientId') patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ProfessionalPatientConsultationsResponseDto> {
    return this.professionalService.getMyPatientConsultations(
      user.id,
      patientId,
      {
        page,
        limit,
      },
    );
  }

  @Get('me/patients/:patientId/notes')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'List notes for one patient' })
  @ApiParam({ name: 'patientId', description: 'Patient user UUID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number. Defaults to 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Records per page. Defaults to 20 for the full notes view.',
  })
  @ApiResponse({ status: 200, type: ProfessionalPatientNotesResponseDto })
  getMyPatientNotes(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('patientId') patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ProfessionalPatientNotesResponseDto> {
    return this.professionalService.getMyPatientNotes(user.id, patientId, {
      page,
      limit,
    });
  }

  @Post('me/patients/:patientId/notes')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a note for one patient' })
  @ApiParam({ name: 'patientId', description: 'Patient user UUID' })
  @ApiResponse({ status: 201, type: ProfessionalPatientNoteResponseDto })
  createMyPatientNote(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('patientId') patientId: string,
    @Body() dto: CreateProfessionalPatientNoteDto,
  ): Promise<ProfessionalPatientNoteResponseDto> {
    return this.professionalService.createMyPatientNote(
      user.id,
      patientId,
      dto,
    );
  }

  @Patch('me/patients/:patientId/notes/:noteId')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Update one patient note' })
  @ApiParam({ name: 'patientId', description: 'Patient user UUID' })
  @ApiParam({ name: 'noteId', description: 'Patient note UUID' })
  @ApiResponse({ status: 200, type: ProfessionalPatientNoteResponseDto })
  updateMyPatientNote(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('patientId') patientId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateProfessionalPatientNoteDto,
  ): Promise<ProfessionalPatientNoteResponseDto> {
    return this.professionalService.updateMyPatientNote(
      user.id,
      patientId,
      noteId,
      dto,
    );
  }

  @Patch('me/bookings/:bookingId/accept')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Accept an appointment request' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, type: ProfessionalAppointmentResponseDto })
  acceptMyBooking(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('bookingId') bookingId: string,
  ): Promise<ProfessionalAppointmentResponseDto> {
    return this.professionalService.acceptMyBooking(user.id, bookingId);
  }

  @Patch('me/bookings/:bookingId/reject')
  @UseGuards(RolesGuard)
  @Roles(...PROFESSIONAL_ACCESS_ROLES)
  @ApiOperation({ summary: 'Reject an appointment request' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, type: ProfessionalAppointmentResponseDto })
  rejectMyBooking(
    @CurrentUser() user: IRequestWithUser['user'],
    @Param('bookingId') bookingId: string,
  ): Promise<ProfessionalAppointmentResponseDto> {
    return this.professionalService.rejectMyBooking(user.id, bookingId);
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.PATIENT)
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
    description: 'Slots created.',
    type: [ProfessionalAvailabilityResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  @ApiResponse({ status: 409, description: 'One or more slots already exist' })
  createAvailabilities(
    @Param('id') id: string,
    @Body() dto: BulkCreateAvailabilityDto,
  ): Promise<ProfessionalAvailabilityResponseDto[]> {
    return this.professionalService.createAvailabilities(id, dto);
  }
}
