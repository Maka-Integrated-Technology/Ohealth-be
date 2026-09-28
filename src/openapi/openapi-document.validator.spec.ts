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
});
