import { Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import { PublicDiscoveryContractDto } from './dto/public-discovery-response.dto';
import { PublicDiscoveryRoutes } from './public-discovery.decorators';
import { PublicDiscoveryService } from './public-discovery.service';

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
