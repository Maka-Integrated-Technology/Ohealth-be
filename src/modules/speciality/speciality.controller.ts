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

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

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
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new speciality (admin only)' })
  @ApiResponse({ status: 201, type: SpecialityResponseDto })
  @ApiResponse({ status: 409, description: 'Speciality name already exists' })
  create(@Body() dto: CreateSpecialityDto): Promise<SpecialityResponseDto> {
    return this.specialityService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
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
