import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

import { CreatePharmacyDto } from './dto/create-pharmacy.dto';
import { PharmacyResponseDto } from './dto/pharmacy-response.dto';
import { PharmacyService } from './pharmacy.service';

@ApiTags('Pharmacies')
@Controller('pharmacies')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a pharmacy for onboarding review' })
  @ApiResponse({ status: 201, type: PharmacyResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'Pharmacy registration number or license number already exists',
  })
  register(@Body() dto: CreatePharmacyDto): Promise<PharmacyResponseDto> {
    return this.pharmacyService.register(dto);
  }
}
