import { Injectable } from '@nestjs/common';

/**
 * The current instant as public discovery sees it. Time-dependent rules read
 * it from here so they compare instants, not the wall clock of the server,
 * and so tests can fix it.
 */
@Injectable()
export class PublicDiscoveryClock {
  now(): Date {
    return new Date();
  }
}
