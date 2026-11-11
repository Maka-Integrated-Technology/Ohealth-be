/* eslint-disable @typescript-eslint/naming-convention */
import { assertOpenApiDocumentComplete } from './openapi-document.validator';

import type { OpenAPIObject } from '@nestjs/swagger';
import type { ResponseObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

function createCompleteDocument(): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      '/api/items/{id}': {
        get: {
          operationId: 'ItemsController_findOne',
          summary: 'Get an item',
          tags: ['Items'],
          security: [{ bearer: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      {
                        $ref: '#/components/schemas/ApiSuccessResponseDto',
                      },
                    ],
                  },
                },
              },
            },
            500: {
              description: 'Failure',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiErrorResponseDto',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: { schemas: {} },
  } as OpenAPIObject;
}

describe('assertOpenApiDocumentComplete', () => {
  it('accepts complete operation metadata', () => {
    expect(() =>
      assertOpenApiDocumentComplete(createCompleteDocument()),
    ).not.toThrow();
  });

  it('reports missing required operation metadata', () => {
    const document = createCompleteDocument();
    document.paths['/api/items/{id}'].get.summary = '';
    const successResponse = document.paths['/api/items/{id}'].get.responses[
      '200'
    ] as ResponseObject;
    successResponse.content = undefined;

    expect(() => assertOpenApiDocumentComplete(document)).toThrow(
      /missing summary[\s\S]*missing an application\/json schema/,
    );
  });

  it('rejects protected operations without bearer security', () => {
    const document = createCompleteDocument();
    document.paths['/api/items/{id}'].get.security = [];

    expect(() => assertOpenApiDocumentComplete(document)).toThrow(
      'protected operation is missing bearer auth',
    );
  });

  it('rejects incomplete multipart file constraints', () => {
    const document = createCompleteDocument();
    document.paths['/api/items/{id}'].get.requestBody = {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
          },
        },
      },
    };

    expect(() => assertOpenApiDocumentComplete(document)).toThrow(
      'multipart file constraints are incomplete',
    );
  });

  it('rejects request body references that bypass schema validation', () => {
    const document = createCompleteDocument();
    document.paths['/api/items/{id}'].get.requestBody = {
      $ref: '#/components/requestBodies/ItemRequest',
    };

    expect(() => assertOpenApiDocumentComplete(document)).toThrow(
      'request body references are not supported',
    );
  });

  it('rejects non-synthetic email examples', () => {
    const document = createCompleteDocument();
    document.components.schemas.User = {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'person@real-domain.test' },
      },
    };

    expect(() => assertOpenApiDocumentComplete(document)).toThrow(
      'non-synthetic email domain',
    );
  });

  it('requires challenge operations to retain their route-specific error schema', () => {
    const document = createCompleteDocument();
    const operation = document.paths['/api/items/{id}'].get;
    operation.operationId = 'AuthController_signup';
    operation.security = [];
    operation.responses['503'] = {
      description: 'Unavailable',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponseDto' },
        },
      },
    };
    document.components.schemas.AuthChallengeErrorResponseDto = {
      type: 'object',
      required: ['status_code', 'message', 'data', 'error_code'],
      properties: {
        status_code: { type: 'integer' },
        message: { type: 'string' },
        data: { nullable: true },
        error_code: {
          type: 'string',
          enum: [
            'AUTH_CHALLENGE_INVALID',
            'AUTH_CHALLENGE_CODE_INVALID',
            'AUTH_CHALLENGE_EXPIRED',
            'AUTH_CHALLENGE_CONSUMED',
            'AUTH_CHALLENGE_SUPERSEDED',
            'AUTH_CHALLENGE_ATTEMPTS_EXHAUSTED',
            'AUTH_CHALLENGE_COOLDOWN',
            'AUTH_CHALLENGE_DELIVERY_UNAVAILABLE',
            'AUTH_SERVICE_TEMPORARILY_UNAVAILABLE',
            'AUTH_RATE_LIMITED',
          ],
        },
      },
    };

    expect(() => assertOpenApiDocumentComplete(document)).toThrow(
      'response 503 must reference AuthChallengeErrorResponseDto',
    );

    const unavailable = operation.responses['503'] as ResponseObject;
    unavailable.content['application/json'].schema = {
      $ref: '#/components/schemas/AuthChallengeErrorResponseDto',
    };
    expect(() => assertOpenApiDocumentComplete(document)).not.toThrow();
  });
});
