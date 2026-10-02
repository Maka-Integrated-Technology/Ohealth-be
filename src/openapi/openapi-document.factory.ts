import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../common/dto/response.dto';

import { transformOpenApiDocument } from './openapi-document.transformer';
import { assertOpenApiDocumentComplete } from './openapi-document.validator';
import {
  OPENAPI_DOCUMENT_DESCRIPTION,
  OPENAPI_DOCUMENT_TITLE,
  OPENAPI_DOCUMENT_VERSION,
} from './openapi.constants';

import type { INestApplication } from '@nestjs/common';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setTitle(OPENAPI_DOCUMENT_TITLE)
    .setDescription(OPENAPI_DOCUMENT_DESCRIPTION)
    .setVersion(OPENAPI_DOCUMENT_VERSION)
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Specialities', 'Medical specialities management')
    .addTag('Professionals', 'Healthcare professionals management')
    .addTag('Pharmacies', 'Pharmacy onboarding and partner registration')
    .addTag(
      'Organization Onboarding',
      'Shared hospital, laboratory, and pharmacy onboarding',
    )
    .addTag('Bookings', 'Appointment booking and management')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Enter JWT token obtained from the login endpoint. Format: Bearer <token>',
    })
    .build();

  const document = SwaggerModule.createDocument(app, configuration, {
    extraModels: [ApiSuccessResponseDto, ApiErrorResponseDto],
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}_${methodKey}`,
  });

  transformOpenApiDocument(document);
  assertOpenApiDocumentComplete(document);
  return document;
}

export function mountOpenApiDocumentation(
  app: INestApplication,
  document: OpenAPIObject,
): void {
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
