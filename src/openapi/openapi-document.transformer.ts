import { getSchemaPath } from '@nestjs/swagger';

import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../common/dto/response.dto';

import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const JSON_MEDIA_TYPE = 'application/json';

const HTTP_METHODS = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
] as const;

function isReferenceObject(
  value: ReferenceObject | ResponseObject | SchemaObject,
): value is ReferenceObject {
  return '$ref' in value;
}

function getComponentName(reference: ReferenceObject): string | undefined {
  const prefix = '#/components/schemas/';
  return reference.$ref.startsWith(prefix)
    ? reference.$ref.slice(prefix.length)
    : undefined;
}

function createDerivedDataSchema(
  document: OpenAPIObject,
  componentName: string,
  component: SchemaObject,
): ReferenceObject | SchemaObject {
  const properties = component.properties ?? {};

  if (
    'data' in properties &&
    ('status_code' in properties || 'statusCode' in properties)
  ) {
    return properties.data as ReferenceObject | SchemaObject;
  }

  if (!('message' in properties)) {
    return { $ref: `#/components/schemas/${componentName}` };
  }

  const envelopeProperties = new Set([
    'data',
    'message',
    'meta',
    'status_code',
    'statusCode',
  ]);
  const dataProperties = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !envelopeProperties.has(key)),
  );

  if (Object.keys(dataProperties).length === 0) {
    return { nullable: true, example: null };
  }

  const derivedName = `${componentName}Data`;
  document.components.schemas[derivedName] = {
    ...component,
    properties: dataProperties,
    required: (component.required ?? []).filter(
      (property) => !envelopeProperties.has(property),
    ),
  };

  return { $ref: `#/components/schemas/${derivedName}` };
}

function normalizeDataSchema(
  document: OpenAPIObject,
  schema: ReferenceObject | SchemaObject,
): ReferenceObject | SchemaObject {
  if (isReferenceObject(schema)) {
    const componentName = getComponentName(schema);
    const component = componentName
      ? document.components.schemas?.[componentName]
      : undefined;

    if (componentName && component && !isReferenceObject(component)) {
      return createDerivedDataSchema(document, componentName, component);
    }

    return schema;
  }

  if (
    schema.type === 'object' &&
    schema.properties?.data &&
    (schema.properties.status_code || schema.properties.statusCode)
  ) {
    return schema.properties.data as ReferenceObject | SchemaObject;
  }

  if (schema.type !== 'object' || !schema.properties?.message) {
    return schema;
  }

  const properties = Object.fromEntries(
    Object.entries(schema.properties).filter(
      ([key]) =>
        !['data', 'message', 'meta', 'status_code', 'statusCode'].includes(key),
    ),
  );

  return Object.keys(properties).length === 0
    ? { nullable: true, example: null }
    : {
        ...schema,
        properties,
        required: (schema.required ?? []).filter((key) => key in properties),
      };
}

function ensureJsonErrorSchema(response: ResponseObject): void {
  response.content = {
    ...response.content,
    [JSON_MEDIA_TYPE]: {
      ...response.content?.['application/json'],
      schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
    },
  };
}

function ensureErrorResponse(
  operation: OperationObject,
  status: string,
  description: string,
): void {
  const existing = operation.responses[status];
  const response: ResponseObject =
    existing && !isReferenceObject(existing) ? existing : { description };

  ensureJsonErrorSchema(response);
  operation.responses[status] = response;
}

function wrapSuccessResponse(
  document: OpenAPIObject,
  response: ResponseObject,
): void {
  const mediaType = response.content?.['application/json'];
  if (!mediaType?.schema) return;

  const dataSchema = normalizeDataSchema(document, mediaType.schema);
  mediaType.schema = {
    allOf: [
      { $ref: getSchemaPath(ApiSuccessResponseDto) },
      {
        type: 'object',
        required: ['data'],
        properties: { data: dataSchema },
      },
    ],
  };
}

function transformOperation(
  document: OpenAPIObject,
  operation: OperationObject,
): void {
  Object.entries(operation.responses).forEach(([status, value]) => {
    if (isReferenceObject(value)) return;

    if (/^2\d\d$/.test(status)) {
      wrapSuccessResponse(document, value);
    } else if (/^[45]\d\d$/.test(status) || status === 'default') {
      ensureJsonErrorSchema(value);
    }
  });

  if (operation.requestBody) {
    ensureErrorResponse(operation, '400', 'Request validation failed');
  }

  if ((operation.security ?? []).length > 0) {
    ensureErrorResponse(operation, '401', 'Authentication is required');
  }

  ensureErrorResponse(operation, '500', 'Internal server error');
}

export function transformOpenApiDocument(
  document: OpenAPIObject,
): OpenAPIObject {
  const successEnvelope = document.components.schemas?.[
    ApiSuccessResponseDto.name
  ] as SchemaObject | undefined;

  if (successEnvelope?.properties?.data) {
    successEnvelope.properties.data = { nullable: true };
  }

  Object.values(document.paths).forEach((pathItem) => {
    HTTP_METHODS.forEach((method) => {
      const operation = pathItem?.[method] as OperationObject | undefined;
      if (operation) transformOperation(document, operation);
    });
  });

  return document;
}
