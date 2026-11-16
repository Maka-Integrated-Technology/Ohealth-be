import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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

import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateSpecialityDto } from './dto/create-speciality.dto';
import { SpecialityResponseDto } from './dto/speciality-response.dto';
import { UpdateSpecialityDto } from './dto/update-speciality.dto';
import { SpecialityService } from './speciality.service';

@ApiTags('Specialities')
@Controller('specialities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpecialityController {
  constructor(private readonly specialityService: SpecialityService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active specialities' })
  @ApiResponse({ status: 200, type: [SpecialityResponseDto] })
  findAll(): Promise<SpecialityResponseDto[]> {
    return this.specialityService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a speciality by ID' })
  @ApiParam({ name: 'id', description: 'Speciality UUID' })
  @ApiResponse({ status: 200, type: SpecialityResponseDto })
  @ApiResponse({ status: 404, description: 'Speciality not found' })
  findOne(@Param('id') id: string): Promise<SpecialityResponseDto> {
    return this.specialityService.findById(id);
  }

  @Post()
  @UseGuards(CapabilitiesGuard)
  @RequireCapabilities(AuthCapability.PLATFORM_SPECIALITY_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new speciality (admin only)' })
  @ApiResponse({ status: 201, type: SpecialityResponseDto })
  @ApiResponse({ status: 409, description: 'Speciality name already exists' })
  create(@Body() dto: CreateSpecialityDto): Promise<SpecialityResponseDto> {
    return this.specialityService.create(dto);
  }

  @Patch(':id')
  @UseGuards(CapabilitiesGuard)
  @RequireCapabilities(AuthCapability.PLATFORM_SPECIALITY_MANAGE)
  @ApiOperation({ summary: 'Update a speciality (admin only)' })
  @ApiParam({ name: 'id', description: 'Speciality UUID' })
  @ApiResponse({ status: 200, type: SpecialityResponseDto })
  @ApiResponse({ status: 404, description: 'Speciality not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSpecialityDto,
  ): Promise<SpecialityResponseDto> {
    return this.specialityService.update(id, dto);
  }
}
