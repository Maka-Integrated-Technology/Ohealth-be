import { Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import { PublicProfessionalDirectoryQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import { PublicProfessionalDirectoryDto } from '../public-discovery/dto/public-discovery-response.dto';
import {
  ApiPublicValidationError,
  PublicDiscoveryRoutes,
} from '../public-discovery/public-discovery.decorators';

import { PublicProfessionalService } from './public-professional.service';

/**
 * Unauthenticated, read-only view of approved professionals. Profile
 * management, bookings, and reviews stay on the guarded controllers.
 */
@PublicDiscoveryRoutes('professionals')
export class PublicProfessionalController {
  constructor(
    private readonly professionalService: PublicProfessionalService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search the directory of approved professionals',
    description:
      'Returns active, approved professionals owned by active accounts. The search term matches the display name or the speciality name, ignoring case. Results are ordered by the requested sort and then by identifier.',
  })
  @ApiOkResponse({ type: PublicProfessionalDirectoryDto })
  @ApiPublicValidationError()
  list(
    @Query() query: PublicProfessionalDirectoryQueryDto,
  ): Promise<PublicProfessionalDirectoryDto> {
    return this.professionalService.findDirectory(query);
  }
}
