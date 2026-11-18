import { Get, Header, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import {
  PublicAvailabilityQueryDto,
  PublicProfessionalDirectoryQueryDto,
} from '../public-discovery/dto/public-discovery-query.dto';
import {
  PublicProfessionalAvailabilityDto,
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
 * management, schedule changes, bookings, and reviews stay on the guarded
 * controllers.
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

  @Get(':id/availability')
  // A slot can be taken at any moment, so a stored copy must not be reused.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get the open future slots of one approved professional',
    description:
      'Returns the slots inside the requested dates that start after the response is produced, are still offered, and are not occupied by a booking, in pages of at most 500 ordered by start instant; send next_cursor as cursor, with the same dates, to read the next page. Every slot declares the IANA time zone its date and times are local to and its start and end as UTC instants; no time is local to the server. Availability is information, not a reservation: a returned slot can be taken at any moment, and booking creation revalidates and reserves the slot atomically and can still refuse it.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Professional identifier from the public directory',
  })
  @ApiOkResponse({ type: PublicProfessionalAvailabilityDto })
  @ApiPublicValidationError()
  @ApiPublicResourceNotFound()
  findAvailability(
    @Param('id', PublicResourceIdPipe) id: string,
    @Query() query: PublicAvailabilityQueryDto,
  ): Promise<PublicProfessionalAvailabilityDto> {
    return this.professionalService.findAvailability(id, query);
  }
}
