import { Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

import { PublicResourceNotFoundException } from './public-discovery.errors';

/**
 * Validates a public resource identifier before it reaches a query. A
 * malformed identifier is reported exactly like a missing resource rather
 * than as a validation or database error.
 */
@Injectable()
export class PublicResourceIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !isUUID(value)) {
      throw new PublicResourceNotFoundException();
    }
    return value.toLowerCase();
  }
}
