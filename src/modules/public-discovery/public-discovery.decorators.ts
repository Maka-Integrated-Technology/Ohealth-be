import { applyDecorators, Controller } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { ApiErrorResponseDto } from '../../common/dto/response.dto';

import {
  PUBLIC_DISCOVERY_API_TAG,
  PUBLIC_DISCOVERY_ROUTE_NAMESPACE,
  PUBLIC_RESOURCE_NOT_FOUND_MESSAGE,
} from './public-discovery.constants';

/**
 * Declares a controller inside the public discovery boundary. Every route it
 * owns lives under the public namespace, needs no credentials, and is
 * documented under one tag. Only read-only discovery handlers belong in a
 * controller declared this way; authenticated, owner, reviewer, and admin
 * operations stay on their guarded controllers.
 */
export const PublicDiscoveryRoutes = (resource: string): ClassDecorator =>
  applyDecorators(
    Controller(`${PUBLIC_DISCOVERY_ROUTE_NAMESPACE}/${resource}`),
    Public(),
    ApiTags(PUBLIC_DISCOVERY_API_TAG),
  );

/** Documents the shared query-validation failure of a public operation. */
export const ApiPublicValidationError = (): MethodDecorator =>
  ApiBadRequestResponse({
    description: 'A query parameter failed validation',
    type: ApiErrorResponseDto,
  });

/** Documents the single non-enumerating not-found outcome. */
export const ApiPublicResourceNotFound = (): MethodDecorator =>
  ApiNotFoundResponse({
    description: `${PUBLIC_RESOURCE_NOT_FOUND_MESSAGE}. Returned identically for missing, malformed, and non-public resources.`,
    type: ApiErrorResponseDto,
  });
