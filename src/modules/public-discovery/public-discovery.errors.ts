import { NotFoundException } from '@nestjs/common';

import {
  PUBLIC_RESOURCE_NOT_FOUND_MESSAGE,
  PublicDiscoveryErrorCode,
} from './public-discovery.constants';

/**
 * The single not-found outcome for public discovery. Missing, malformed,
 * inactive, unapproved, suspended, and deactivated resources all produce this
 * exact response so a caller cannot learn which of those states applies.
 */
export class PublicResourceNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: PUBLIC_RESOURCE_NOT_FOUND_MESSAGE,
      error: 'Not Found',
      error_code: PublicDiscoveryErrorCode.RESOURCE_NOT_FOUND,
    });
  }
}
