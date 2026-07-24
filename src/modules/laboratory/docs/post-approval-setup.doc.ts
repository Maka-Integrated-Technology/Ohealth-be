import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import {
  AcceptLaboratoryStaffInvitationResponseDto,
  InviteLaboratoryStaffResponseDto,
  LaboratoryOperatingHourResponseDto,
  LaboratoryStaffResponseDto,
  LaboratoryTestResponseDto,
} from '../dto/laboratory-post-approval.dto';

export const SetLaboratoryOperatingHoursDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Set laboratory operating hours by day' }),
    ApiOkResponse({ type: [LaboratoryOperatingHourResponseDto] }),
    ApiBadRequestResponse({
      description: 'Invalid or duplicate operating-hour entries',
    }),
  );

export const ListLaboratoryOperatingHoursDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get laboratory operating hours' }),
    ApiOkResponse({ type: [LaboratoryOperatingHourResponseDto] }),
  );

export const CreateLaboratoryTestDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Add a test to the laboratory catalogue' }),
    ApiCreatedResponse({ type: LaboratoryTestResponseDto }),
    ApiConflictResponse({
      description: 'A test with this name already exists for the laboratory',
    }),
  );

export const ListLaboratoryTestsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List the laboratory test catalogue' }),
    ApiOkResponse({ type: [LaboratoryTestResponseDto] }),
  );

export const UpdateLaboratoryTestDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a laboratory catalogue test' }),
    ApiOkResponse({ type: LaboratoryTestResponseDto }),
    ApiNotFoundResponse({ description: 'Laboratory test not found' }),
    ApiConflictResponse({
      description: 'A test with this name already exists for the laboratory',
    }),
  );

export const InviteLaboratoryStaffDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Invite a laboratory staff member' }),
    ApiCreatedResponse({ type: InviteLaboratoryStaffResponseDto }),
    ApiConflictResponse({
      description: 'The email already belongs to a user or active invitation',
    }),
  );

export const ListLaboratoryStaffDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List laboratory staff and invitations' }),
    ApiOkResponse({ type: [LaboratoryStaffResponseDto] }),
  );

export const AcceptLaboratoryStaffInvitationDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Accept a laboratory staff invitation' }),
    ApiOkResponse({ type: AcceptLaboratoryStaffInvitationResponseDto }),
    ApiBadRequestResponse({
      description: 'Invitation is invalid, expired, or no longer usable',
    }),
    ApiConflictResponse({
      description: 'An account already exists for the invited email',
    }),
  );
