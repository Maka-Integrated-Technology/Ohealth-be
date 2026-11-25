import { ConfigService } from '@nestjs/config';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../common/dto/response.dto';
import { RegistrationService } from '../modules/auth/registration/registration.service';

import {
  committedAuthRequestExamples,
  type IAuthRequestExampleValues,
} from './auth-request-variants';
import { transformOpenApiDocument } from './openapi-document.transformer';
import { assertOpenApiDocumentComplete } from './openapi-document.validator';
import { isOpenApiContractGenerationEnabled } from './openapi-generation-context';
import {
  OPENAPI_DOCUMENT_DESCRIPTION,
  OPENAPI_DOCUMENT_TITLE,
  OPENAPI_DOCUMENT_VERSION,
} from './openapi.constants';

import type { INestApplication } from '@nestjs/common';

export function resolveAuthRequestExampleValues(
  app: INestApplication,
): IAuthRequestExampleValues {
  if (isOpenApiContractGenerationEnabled()) return committedAuthRequestExamples;
  const bootstrap = app.get(RegistrationService).getBootstrap();
  const config = app.get(ConfigService);
  const firstAudience = (key: string): string | undefined =>
    config
      .get<string>(key)
      ?.split(',')
      .map((value) => value.trim())
      .find(Boolean);
  const googleEnabled = config.get<boolean>('oauth.google.enabled');
  return {
    termsVersion: bootstrap.terms.version,
    privacyVersion: bootstrap.privacy.version,
    googleWebAudience: googleEnabled
      ? firstAudience('oauth.google.webClientIds')
      : undefined,
    googleMobileAudience: googleEnabled
      ? firstAudience('oauth.google.mobileClientIds')
      : undefined,
  };
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const examples = resolveAuthRequestExampleValues(app);
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
    .addTag(
      'Public Discovery',
      'Unauthenticated, read-only speciality and professional discovery',
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Enter JWT token obtained from the login endpoint. Format: Bearer <token>',
    })
    .addCookieAuth(
      '__Host-ohealth_refresh',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Backend-managed browser refresh cookie. Local development uses a separate cookie name.',
      },
      'browserRefresh',
    )
    .build();

  const document = SwaggerModule.createDocument(app, configuration, {
    extraModels: [ApiSuccessResponseDto, ApiErrorResponseDto],
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}_${methodKey}`,
  });

  transformOpenApiDocument(document, examples);
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
