import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';

import {
  LaboratoryVerificationStatusHistoryResponseDto,
  LaboratoryVerificationStatusResponseDto,
} from '../dto/laboratory-verification-status.dto';

export const GetMyLaboratoryVerificationStatusDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get verification status for current laboratory' }),
    ApiOkResponse({ type: LaboratoryVerificationStatusResponseDto }),
    ApiNotFoundResponse({ description: 'Laboratory administrator not found' }),
  );

export const SubmitMyLaboratoryVerificationDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Submit current laboratory for verification' }),
    ApiOkResponse({ type: LaboratoryVerificationStatusResponseDto }),
    ApiBadRequestResponse({
      description: 'Missing required documents or invalid status transition',
    }),
    ApiNotFoundResponse({ description: 'Laboratory administrator not found' }),
  );

export const GetLaboratoryVerificationStatusForAdminDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get laboratory verification status' }),
    ApiParam({ name: 'laboratoryId', type: String }),
    ApiOkResponse({ type: LaboratoryVerificationStatusResponseDto }),
    ApiNotFoundResponse({ description: 'Laboratory not found' }),
  );

export const ListLaboratoryVerificationStatusHistoryDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List laboratory verification status history' }),
    ApiParam({ name: 'laboratoryId', type: String }),
    ApiOkResponse({ type: [LaboratoryVerificationStatusHistoryResponseDto] }),
    ApiNotFoundResponse({ description: 'Laboratory not found' }),
  );

export const MarkLaboratoryVerificationUnderReviewDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Move laboratory verification to under review' }),
    ApiParam({ name: 'laboratoryId', type: String }),
    ApiOkResponse({ type: LaboratoryVerificationStatusResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid status transition' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
    ApiNotFoundResponse({ description: 'Laboratory not found' }),
  );

export const ApproveLaboratoryVerificationDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Approve laboratory verification' }),
    ApiParam({ name: 'laboratoryId', type: String }),
    ApiOkResponse({ type: LaboratoryVerificationStatusResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid status transition' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
    ApiNotFoundResponse({ description: 'Laboratory not found' }),
  );

export const RejectLaboratoryVerificationDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Reject laboratory verification' }),
    ApiParam({ name: 'laboratoryId', type: String }),
    ApiOkResponse({ type: LaboratoryVerificationStatusResponseDto }),
    ApiBadRequestResponse({
      description: 'Invalid status transition or missing rejection reason',
    }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
    ApiNotFoundResponse({ description: 'Laboratory not found' }),
  );
