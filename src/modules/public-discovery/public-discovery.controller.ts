import { Get, Header } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import {
  PublicAvailabilityDayDto,
  PublicDiscoveryContractDto,
  PublicPaginationMetaDto,
  PublicProfessionalDetailDto,
  PublicProfessionalSummaryDto,
  PublicSpecialityDto,
} from './dto/public-discovery-response.dto';
import { PublicDiscoveryRoutes } from './public-discovery.decorators';
import { PublicDiscoveryService } from './public-discovery.service';

// Publishes the shared response models in the contract before the endpoints
// that return them exist, so consumers and reviewers see one stable shape.
@ApiExtraModels(
  PublicSpecialityDto,
  PublicProfessionalSummaryDto,
  PublicProfessionalDetailDto,
  PublicAvailabilityDayDto,
  PublicPaginationMetaDto,
)
@PublicDiscoveryRoutes('discovery')
export class PublicDiscoveryController {
  constructor(private readonly discoveryService: PublicDiscoveryService) {}

  @Get('contract')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Get the query limits and allowlists for public discovery',
  })
  @ApiOkResponse({ type: PublicDiscoveryContractDto })
  getContract(): PublicDiscoveryContractDto {
    return this.discoveryService.getContract();
  }
}
