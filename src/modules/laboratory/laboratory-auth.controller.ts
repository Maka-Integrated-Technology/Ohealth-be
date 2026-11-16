import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthCapability } from '../auth/context/auth-capability';
import { RequireCapabilities } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { LaboratoryAdminSetupDocs } from './docs';
import { LaboratoryAdminSetupDto } from './dto/laboratory-admin-setup.dto';
import { ILaboratoryAdminSetupResult } from './interfaces/laboratory-admin-setup-result.interface';
import { LaboratoryAuthService } from './laboratory-auth.service';

@ApiTags('Laboratory Authentication & Onboarding')
@Controller('laboratories/auth')
export class LaboratoryAuthController {
  constructor(private readonly laboratoryAuthService: LaboratoryAuthService) {}

  @Post('admin-setup')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities(AuthCapability.PLATFORM_ORGANIZATION_REVIEW)
  @HttpCode(HttpStatus.CREATED)
  @LaboratoryAdminSetupDocs()
  setupAdministrator(
    @Body() dto: LaboratoryAdminSetupDto,
  ): Promise<ILaboratoryAdminSetupResult> {
    return this.laboratoryAuthService.setupAdministrator(dto);
  }
}
