import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SpecialityService } from './speciality.service';
import { SpecialityResponseDto } from './dto/speciality-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Specialities')
@Controller('specialities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpecialityController {
  constructor(private readonly specialityService: SpecialityService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active specialities' })
  @ApiResponse({
    status: 200,
    description: 'List of specialities',
    type: [SpecialityResponseDto],
  })
  async findAll(): Promise<SpecialityResponseDto[]> {
    return this.specialityService.findAll();
  }
}
