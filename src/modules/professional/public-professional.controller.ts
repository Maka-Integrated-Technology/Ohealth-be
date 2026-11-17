import { Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import { PublicProfessionalDirectoryQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import {
  PublicProfessionalDetailDto,
  PublicProfessionalDirectoryDto,
} from '../public-discovery/dto/public-discovery-response.dto';
import {
  ApiPublicResourceNotFound,
  ApiPublicValidationError,
  PublicDiscoveryRoutes,
} from '../public-discovery/public-discovery.decorators';
import { PublicResourceIdPipe } from '../public-discovery/public-resource-id.pipe';

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

  @Get(':id')
  @ApiOperation({
    summary: 'Get the public profile of one approved professional',
    description:
      'Returns the profile only while the professional is publicly visible. The rating and review count are aggregated from the review records; no individual review is returned. Text fields are plain text, never HTML.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Professional identifier from the public directory',
  })
  @ApiOkResponse({ type: PublicProfessionalDetailDto })
  @ApiPublicResourceNotFound()
  findOne(
    @Param('id', PublicResourceIdPipe) id: string,
  ): Promise<PublicProfessionalDetailDto> {
    return this.professionalService.findOne(id);
  }
}
