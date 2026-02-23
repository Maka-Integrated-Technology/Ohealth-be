import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  ProfessionalResponseDto,
  ProfessionalDetailResponseDto,
} from './dto/professional-response.dto';
import { ProfessionalService } from './professional.service';

@ApiTags('Professionals')
@Controller('professionals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfessionalController {
  constructor(private readonly professionalService: ProfessionalService) {}

  @Get()
  @ApiOperation({ summary: 'Get professionals by speciality' })
  @ApiQuery({ name: 'speciality_id', required: true })
  @ApiResponse({
    status: 200,
    description: 'List of professionals',
    type: [ProfessionalResponseDto],
  })
  async findBySpeciality(
    @Query('speciality_id') specialityId: string,
  ): Promise<ProfessionalResponseDto[]> {
    return this.professionalService.findBySpeciality(specialityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get professional details with availability' })
  @ApiParam({ name: 'id', description: 'Professional ID' })
  @ApiResponse({
    status: 200,
    description: 'Professional details',
    type: ProfessionalDetailResponseDto,
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<ProfessionalDetailResponseDto> {
    return this.professionalService.findOne(id);
  }
}
