import { Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import { PublicSearchQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import {
  PublicSpecialityCatalogueDto,
  PublicSpecialityDto,
} from '../public-discovery/dto/public-discovery-response.dto';
import {
  ApiPublicResourceNotFound,
  ApiPublicValidationError,
  PublicDiscoveryRoutes,
} from '../public-discovery/public-discovery.decorators';
import { PublicResourceIdPipe } from '../public-discovery/public-resource-id.pipe';

import { SpecialityService } from './speciality.service';

/**
 * Unauthenticated, read-only view of the speciality catalogue. Administration
 * stays on the guarded `SpecialityController`.
 */
@PublicDiscoveryRoutes('specialities')
export class PublicSpecialityController {
  constructor(private readonly specialityService: SpecialityService) {}

  @Get()
  @ApiOperation({
    summary: 'List active specialities',
    description:
      'Ordered by name without regard to case, then by identifier. The optional search term matches any part of the name, ignoring case.',
  })
  @ApiOkResponse({ type: PublicSpecialityCatalogueDto })
  @ApiPublicValidationError()
  list(
    @Query() query: PublicSearchQueryDto,
  ): Promise<PublicSpecialityCatalogueDto> {
    return this.specialityService.findPublicCatalogue(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one active speciality' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Canonical speciality identifier',
  })
  @ApiOkResponse({ type: PublicSpecialityDto })
  @ApiPublicResourceNotFound()
  findOne(
    @Param('id', PublicResourceIdPipe) id: string,
  ): Promise<PublicSpecialityDto> {
    return this.specialityService.findPublicById(id);
  }
}
