import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryAdminSetupDocs } from './docs';
import { LaboratoryAdminSetupDto } from './dto/laboratory-admin-setup.dto';
import { ILaboratoryAdminSetupResult } from './interfaces/laboratory-admin-setup-result.interface';
import { LaboratoryAuthService } from './laboratory-auth.service';

@ApiTags('Laboratory Authentication & Onboarding')
@Controller('laboratories/auth')
export class LaboratoryAuthController {
  constructor(private readonly laboratoryAuthService: LaboratoryAuthService) {}

  @Post('admin-setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @LaboratoryAdminSetupDocs()
  setupAdministrator(
    @Body() dto: LaboratoryAdminSetupDto,
  ): Promise<ILaboratoryAdminSetupResult> {
    return this.laboratoryAuthService.setupAdministrator(dto);
  }
}
