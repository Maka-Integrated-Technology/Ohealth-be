import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { SetupOrganizationResponseDto } from '../dto/organization-response.dto';
import {
  OrganizationDocumentChecklistDto,
  OrganizationDocumentDownloadDto,
  OrganizationDocumentResponseDto,
  OrganizationReviewListResponseDto,
  OrganizationStatusHistoryResponseDto,
  OrganizationStatusResponseDto,
} from '../dto/organization-verification.dto';

export const SetupOrganizationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create an organization and its primary administrator',
    }),
    ApiCreatedResponse({ type: SetupOrganizationResponseDto }),
    ApiConflictResponse({
      description: 'Registration number or administrator email already exists',
    }),
    ApiBadRequestResponse({ description: 'Invalid organization setup data' }),
  );

export const UploadOrganizationDocumentDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Upload or replace an onboarding document' }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary' } },
      },
    }),
    ApiOkResponse({ type: OrganizationDocumentResponseDto }),
    ApiBadRequestResponse({
      description: 'Invalid document, file, or onboarding state',
    }),
    ApiForbiddenResponse({
      description: 'Organization administrator role required',
    }),
  );

export const ListOrganizationDocumentsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List uploaded and missing onboarding documents' }),
    ApiOkResponse({ type: OrganizationDocumentChecklistDto }),
    ApiNotFoundResponse({ description: 'Organization not found' }),
  );

export const DownloadOrganizationDocumentDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a private document download URL' }),
    ApiOkResponse({ type: OrganizationDocumentDownloadDto }),
    ApiNotFoundResponse({ description: 'Organization document not found' }),
  );

export const DeleteOrganizationDocumentDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete an onboarding document before review' }),
    ApiOkResponse({ description: 'Organization document deleted' }),
    ApiBadRequestResponse({
      description: 'Documents are locked after review starts',
    }),
  );

export const GetOrganizationStatusDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get organization verification status' }),
    ApiOkResponse({ type: OrganizationStatusResponseDto }),
  );

export const SubmitOrganizationDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Submit complete organization onboarding' }),
    ApiOkResponse({ type: OrganizationStatusResponseDto }),
    ApiBadRequestResponse({
      description: 'Required documents are missing or transition is invalid',
    }),
  );

export const ListOrganizationApplicationsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List organization review applications' }),
    ApiOkResponse({ type: OrganizationReviewListResponseDto }),
  );

export const ListOrganizationStatusHistoryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List auditable organization status changes' }),
    ApiOkResponse({ type: [OrganizationStatusHistoryResponseDto] }),
  );

export const TransitionOrganizationDocs = (summary: string) =>
  applyDecorators(
    ApiOperation({ summary }),
    ApiOkResponse({ type: OrganizationStatusResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid status transition' }),
  );
