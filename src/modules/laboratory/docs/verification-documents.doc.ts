import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
} from '@nestjs/swagger';

import { LaboratoryVerificationDocumentResponseDto } from '../dto/laboratory-verification-document-response.dto';
import { LaboratoryVerificationDocumentType } from '../enums/laboratory-verification-document-type.enum';

export const UploadLaboratoryVerificationDocumentDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Upload or replace a verification document for current lab',
    }),
    ApiParam({
      name: 'documentType',
      enum: LaboratoryVerificationDocumentType,
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
    ApiOkResponse({ type: LaboratoryVerificationDocumentResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid document type or file' }),
    ApiForbiddenResponse({
      description:
        'Document changes are not allowed after the application enters review',
    }),
    ApiPayloadTooLargeResponse({ description: 'File exceeds size limit' }),
  );

export const ListMyLaboratoryVerificationDocumentsDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List verification documents for current lab',
    }),
    ApiOkResponse({
      description:
        'Returns uploaded documents plus required document types still missing.',
    }),
  );

export const DownloadMyLaboratoryVerificationDocumentDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a signed download URL for current lab document',
    }),
    ApiParam({
      name: 'documentType',
      enum: LaboratoryVerificationDocumentType,
    }),
    ApiOkResponse({ description: 'Signed download URL created' }),
    ApiNotFoundResponse({ description: 'Document not found' }),
  );

export const DeleteMyLaboratoryVerificationDocumentDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Delete a verification document for current lab',
    }),
    ApiParam({
      name: 'documentType',
      enum: LaboratoryVerificationDocumentType,
    }),
    ApiOkResponse({ description: 'Document deleted' }),
    ApiForbiddenResponse({
      description:
        'Document changes are not allowed after the application enters review',
    }),
  );

export const ListLaboratoryVerificationDocumentsForAdminDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List verification documents for a laboratory',
    }),
    ApiParam({ name: 'laboratoryId', description: 'Laboratory UUID' }),
    ApiOkResponse({
      description:
        'Returns uploaded documents plus required document types still missing.',
    }),
  );

export const DownloadLaboratoryVerificationDocumentForAdminDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create a signed download URL for a laboratory document',
    }),
    ApiParam({ name: 'laboratoryId', description: 'Laboratory UUID' }),
    ApiParam({
      name: 'documentType',
      enum: LaboratoryVerificationDocumentType,
    }),
    ApiOkResponse({ description: 'Signed download URL created' }),
    ApiNotFoundResponse({ description: 'Document not found' }),
  );
