import { BadRequestException, NotFoundException } from '@nestjs/common';

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

/**
 * A well-formed query refused by a rule that depends on the current instant,
 * which request validation cannot know. It has the shape of a validation
 * failure: one message per parameter. Public handlers raise it before they
 * read the resource, so it never depends on whether that resource exists.
 */
export class PublicQueryRejectedException extends BadRequestException {
  constructor(message: string) {
    super([message]);
  }
}
