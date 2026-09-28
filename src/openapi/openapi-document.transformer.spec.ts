/* eslint-disable @typescript-eslint/naming-convention */
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../common/dto/response.dto';

import { transformOpenApiDocument } from './openapi-document.transformer';

import type { OpenAPIObject } from '@nestjs/swagger';
import type { ResponseObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

describe('transformOpenApiDocument', () => {
  it('wraps success data and supplies standard error schemas', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/api/items': {
          post: {
            operationId: 'ItemsController_create',
            summary: 'Create item',
            tags: ['Items'],
            security: [{ bearer: [] }],
            requestBody: {
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
            responses: {
              201: {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/RawResponse' },
                  },
                },
              },
              404: { description: 'Not found' },
            },
          },
        },
        '/api/profile': {
          get: {
            operationId: 'ProfileController_findOne',
            summary: 'Get profile',
            tags: ['Profile'],
            security: [{ bearer: [] }],
            responses: {
              200: {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['status_code', 'message', 'data'],
                      properties: {
                        status_code: { type: 'integer' },
                        message: { type: 'string' },
                        data: {
                          type: 'object',
                          required: ['id'],
                          properties: { id: { type: 'string' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          [ApiSuccessResponseDto.name]: {
            type: 'object',
            properties: { data: { type: 'object' } },
          },
          [ApiErrorResponseDto.name]: { type: 'object' },
          RawResponse: {
            type: 'object',
            required: ['status_code', 'message', 'id'],
            properties: {
              status_code: { type: 'integer' },
              message: { type: 'string' },
              id: { type: 'string' },
            },
          },
        },
      },
    } as OpenAPIObject;

    transformOpenApiDocument(document);

    const operation = document.paths['/api/items'].post;
    const successResponse = operation.responses['201'] as ResponseObject;
    expect(successResponse.content['application/json'].schema).toEqual({
      allOf: [
        { $ref: '#/components/schemas/ApiSuccessResponseDto' },
        {
          type: 'object',
          required: ['data'],
          properties: {
            data: { $ref: '#/components/schemas/RawResponseData' },
          },
        },
      ],
    });
    expect(document.components.schemas.RawResponseData).toMatchObject({
      required: ['id'],
      properties: { id: { type: 'string' } },
    });

    ['400', '401', '404', '500'].forEach((status) => {
      const errorResponse = operation.responses[status] as ResponseObject;
      expect(errorResponse.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/ApiErrorResponseDto',
      });
    });

    const profileResponse = document.paths['/api/profile'].get.responses[
      '200'
    ] as ResponseObject;
    expect(profileResponse.content['application/json'].schema).toEqual({
      allOf: [
        { $ref: '#/components/schemas/ApiSuccessResponseDto' },
        {
          type: 'object',
          required: ['data'],
          properties: {
            data: {
              type: 'object',
              required: ['id'],
              properties: { id: { type: 'string' } },
            },
          },
        },
      ],
    });
  });
});
