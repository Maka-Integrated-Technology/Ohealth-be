import { Module } from '@nestjs/common';

import { PublicDiscoveryVisibilityPolicy } from './public-discovery-visibility.policy';
import { PublicDiscoveryController } from './public-discovery.controller';
import { PublicDiscoveryService } from './public-discovery.service';
import { PublicResourceIdPipe } from './public-resource-id.pipe';

/**
 * Transport boundary for unauthenticated discovery. It owns the public
 * controllers, visibility policy, and response contract, and reads the
 * existing speciality and professional entities; it defines no tables.
 */
@Module({
  controllers: [PublicDiscoveryController],
  providers: [
    PublicDiscoveryService,
    PublicDiscoveryVisibilityPolicy,
    PublicResourceIdPipe,
  ],
  exports: [PublicDiscoveryVisibilityPolicy, PublicResourceIdPipe],
})
export class PublicDiscoveryModule {}
