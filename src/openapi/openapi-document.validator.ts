import { getSchemaPath } from '@nestjs/swagger';

import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../common/dto/response.dto';
import { AuthChallengeErrorCode } from '../modules/auth/challenges/auth-challenge.error';
import { AuthChallengeErrorResponseDto } from '../modules/auth/contracts/auth-contract-response.dto';
import {
  PUBLIC_DISCOVERY_API_TAG,
  PUBLIC_DISCOVERY_ROUTE_NAMESPACE,
} from '../modules/public-discovery/public-discovery.constants';

import { OPENAPI_API_PREFIX } from './openapi.constants';

import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

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

const PUBLIC_OPERATION_IDS = new Set([
  'BrowserSessionController_logout',
  'BrowserSessionController_refresh',
  'BrowserSessionController_verifyLogin',
  'BrowserSessionController_verifySignup',
  'AuthController_forgotPassword',
  'AuthController_googleLogin',
  'AuthController_login',
  'AuthController_resendLogin',
  'AuthController_resendRecovery',
  'AuthController_getRegistrationBootstrap',
  'AuthController_refreshToken',
  'AuthController_resendVerification',
  'AuthController_resetPassword',
  'AuthController_signup',
  'AuthController_verifySignup',
  'AuthController_verifyLogin',
  'LaboratoryPostApprovalController_acceptStaffInvitation',
  'PharmacyController_register',
  'PublicDiscoveryController_getContract',
]);

const PUBLIC_DISCOVERY_PATH_PREFIX = `/${OPENAPI_API_PREFIX}/${PUBLIC_DISCOVERY_ROUTE_NAMESPACE}/`;

const AUTH_CHALLENGE_ERROR_RESPONSES = new Map<string, readonly string[]>([
  ['BrowserSessionController_verifyLogin', ['400']],
  ['BrowserSessionController_verifySignup', ['400']],
  ['AuthController_forgotPassword', ['429', '503']],
  ['AuthController_login', ['429', '503']],
  ['AuthController_resendLogin', ['400', '429', '503']],
  ['AuthController_resendRecovery', ['400', '429', '503']],
  ['AuthController_resendVerification', ['400', '429', '503']],
  ['AuthController_resetPassword', ['400']],
  ['AuthController_signup', ['503']],
  ['AuthController_verifyLogin', ['400']],
  ['AuthController_verifySignup', ['400']],
]);

function isReferenceObject(value: object): value is ReferenceObject {
  return '$ref' in value;
}

function hasJsonSchema(response: ReferenceObject | ResponseObject): boolean {
  return (
    !isReferenceObject(response) &&
    response.content?.['application/json']?.schema !== undefined
  );
}

function hasEnvelopeReference(
  response: ReferenceObject | ResponseObject,
  schemaPath: string,
): boolean {
  if (isReferenceObject(response)) return false;

  const schema = response.content?.['application/json']?.schema;
  if (!schema) return false;
  if (isReferenceObject(schema)) return schema.$ref === schemaPath;

  return (schema.allOf ?? []).some(
    (entry) => isReferenceObject(entry) && entry.$ref === schemaPath,
  );
}

function hasErrorEnvelope(
  document: OpenAPIObject,
  response: ReferenceObject | ResponseObject,
): boolean {
  if (hasEnvelopeReference(response, getSchemaPath(ApiErrorResponseDto))) {
    return true;
  }
  if (isReferenceObject(response)) return false;

  const schema = response.content?.['application/json']?.schema;
  if (!schema || !isReferenceObject(schema)) return false;
  const componentName = schema.$ref.replace('#/components/schemas/', '');
  const component = document.components.schemas?.[componentName];
  if (!component || isReferenceObject(component)) return false;

  const required = new Set(component.required ?? []);
  return ['status_code', 'message', 'data'].every(
    (property) =>
      property in (component.properties ?? {}) && required.has(property),
  );
}

function hasDirectSchemaReference(
  response: ReferenceObject | ResponseObject,
  schemaPath: string,
): boolean {
  if (isReferenceObject(response)) return false;
  const schema = response.content?.['application/json']?.schema;
  return Boolean(
    schema && isReferenceObject(schema) && schema.$ref === schemaPath,
  );
}

function hasValidAuthChallengeErrorSchema(document: OpenAPIObject): boolean {
  const schema = document.components.schemas?.[
    AuthChallengeErrorResponseDto.name
  ] as SchemaObject | ReferenceObject | undefined;
  if (!schema || isReferenceObject(schema)) return false;

  const errorCode = schema.properties?.error_code;
  return Boolean(
    schema.required?.includes('error_code') &&
    errorCode &&
    !isReferenceObject(errorCode) &&
    JSON.stringify(errorCode.enum) ===
      JSON.stringify(Object.values(AuthChallengeErrorCode)),
  );
}

function validateMultipartBody(
  operationLabel: string,
  requestBody: RequestBodyObject,
  errors: string[],
): void {
  const multipartSchema = requestBody.content['multipart/form-data']?.schema;
  if (!multipartSchema) return;

  if (isReferenceObject(multipartSchema)) {
    errors.push(
      `${operationLabel} multipart body must use an inline file schema`,
    );
    return;
  }

  const file = multipartSchema.properties?.file;
  if (!file || isReferenceObject(file)) {
    errors.push(`${operationLabel} multipart body must define a file schema`);
    return;
  }

  if (
    file.type !== 'string' ||
    file.format !== 'binary' ||
    !multipartSchema.required?.includes('file')
  ) {
    errors.push(
      `${operationLabel} multipart file must be required binary data`,
    );
  }

  if (!file.maxLength || !file.description?.includes('Accepted MIME types:')) {
    errors.push(`${operationLabel} multipart file constraints are incomplete`);
  }
}

function validatePublicDiscoveryBoundary(
  label: string,
  path: string,
  method: string,
  operation: OperationObject,
  errors: string[],
): void {
  if (!path.startsWith(PUBLIC_DISCOVERY_PATH_PREFIX)) return;

  if (method !== 'get') {
    errors.push(`${label} public discovery operation must be read-only`);
  }
  if ((operation.security ?? []).length > 0) {
    errors.push(
      `${label} public discovery operation must not declare a security requirement`,
    );
  }
  if (!operation.tags?.includes(PUBLIC_DISCOVERY_API_TAG)) {
    errors.push(
      `${label} public discovery operation must use the ${PUBLIC_DISCOVERY_API_TAG} tag`,
    );
  }
}

function validateSecurity(
  label: string,
  operation: OperationObject,
  errors: string[],
): void {
  if (!operation.operationId) return;

  const hasBearerSecurity = (operation.security ?? []).some(
    (requirement) => 'bearer' in requirement,
  );
  const shouldBePublic = PUBLIC_OPERATION_IDS.has(operation.operationId);

  if (shouldBePublic && hasBearerSecurity) {
    errors.push(`${label} public operation must not require bearer auth`);
  } else if (!shouldBePublic && !hasBearerSecurity) {
    errors.push(`${label} protected operation is missing bearer auth`);
  }
}

function validateResponses(
  document: OpenAPIObject,
  label: string,
  operation: OperationObject,
  errors: string[],
): void {
  const responses = Object.entries(operation.responses);
  const successResponses = responses.filter(([status]) =>
    /^2\d\d$/.test(status),
  );
  const errorResponses = responses.filter(([status]) =>
    /^(4|5)\d\d$/.test(status),
  );

  if (successResponses.length === 0) {
    errors.push(`${label} is missing a success response`);
  }

  successResponses.forEach(([status, response]) => {
    if (status === '204') return;

    if (!hasJsonSchema(response)) {
      errors.push(
        `${label} response ${status} is missing an application/json schema`,
      );
    } else if (
      !hasEnvelopeReference(response, getSchemaPath(ApiSuccessResponseDto))
    ) {
      errors.push(
        `${label} response ${status} is missing the success envelope`,
      );
    }
  });

  if (errorResponses.length === 0) {
    errors.push(`${label} is missing an error response`);
  }

  errorResponses.forEach(([status, response]) => {
    if (!hasJsonSchema(response)) {
      errors.push(`${label} response ${status} is missing an error schema`);
    } else if (!hasErrorEnvelope(document, response)) {
      errors.push(`${label} response ${status} is missing the error envelope`);
    }
  });

  const challengeStatuses = operation.operationId
    ? AUTH_CHALLENGE_ERROR_RESPONSES.get(operation.operationId)
    : undefined;
  challengeStatuses?.forEach((status) => {
    const response = operation.responses[status];
    if (
      !response ||
      !hasDirectSchemaReference(
        response,
        getSchemaPath(AuthChallengeErrorResponseDto),
      )
    ) {
      errors.push(
        `${label} response ${status} must reference AuthChallengeErrorResponseDto`,
      );
    }
  });
  if (challengeStatuses && !hasValidAuthChallengeErrorSchema(document)) {
    errors.push(
      'AuthChallengeErrorResponseDto.error_code must be required and expose the complete enum catalogue',
    );
  }
}

function validateOperation(
  document: OpenAPIObject,
  path: string,
  method: string,
  operation: OperationObject,
  operationIds: Set<string>,
  errors: string[],
): void {
  const label = `${method.toUpperCase()} ${path}`;

  if (!operation.operationId) {
    errors.push(`${label} is missing operationId`);
  } else if (operationIds.has(operation.operationId)) {
    errors.push(`${label} has duplicate operationId ${operation.operationId}`);
  } else {
    operationIds.add(operation.operationId);
  }

  if (!operation.summary?.trim()) errors.push(`${label} is missing summary`);
  if (!operation.tags?.length) errors.push(`${label} is missing tags`);

  validateSecurity(label, operation, errors);
  validatePublicDiscoveryBoundary(label, path, method, operation, errors);
  validateResponses(document, label, operation, errors);

  const pathParameters = new Set(
    (operation.parameters ?? [])
      .filter(
        (parameter) =>
          !isReferenceObject(parameter) &&
          parameter.in === 'path' &&
          parameter.required,
      )
      .map((parameter) => (isReferenceObject(parameter) ? '' : parameter.name)),
  );

  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    if (!pathParameters.has(match[1])) {
      errors.push(`${label} is missing required path parameter ${match[1]}`);
    }
  }

  const requestBody = operation.requestBody;
  if (requestBody && isReferenceObject(requestBody)) {
    errors.push(`${label} request body references are not supported`);
  } else if (requestBody) {
    const inlineRequestBody = requestBody as RequestBodyObject;
    const requestSchemas = Object.values(inlineRequestBody.content).map(
      (mediaType) => mediaType.schema,
    );
    if (
      requestSchemas.length === 0 ||
      requestSchemas.some((schema) => !schema)
    ) {
      errors.push(`${label} request body is missing a schema`);
    }
    validateMultipartBody(label, inlineRequestBody, errors);
  }
}

function validateSyntheticExamples(
  document: OpenAPIObject,
  errors: string[],
): void {
  const serialized = JSON.stringify(document);
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/\/home\//i, 'local filesystem path'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i, 'private key'],
    [/postgres(?:ql)?:\/\//i, 'database URL'],
  ];

  forbiddenPatterns.forEach(([pattern, label]) => {
    if (pattern.test(serialized)) errors.push(`Contract contains a ${label}`);
  });

  for (const match of serialized.matchAll(
    /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
  )) {
    const domain = match[1].toLowerCase();
    if (domain !== 'example.com' && !domain.endsWith('.example')) {
      errors.push(`Contract contains a non-synthetic email domain: ${domain}`);
    }
  }
}

export function assertOpenApiDocumentComplete(document: OpenAPIObject): void {
  const errors: string[] = [];
  const operationIds = new Set<string>();

  Object.entries(document.paths).forEach(([path, pathItem]) => {
    HTTP_METHODS.forEach((method) => {
      const operation = pathItem?.[method] as OperationObject | undefined;
      if (operation) {
        validateOperation(
          document,
          path,
          method,
          operation,
          operationIds,
          errors,
        );
      }
    });
  });

  validateSyntheticExamples(document, errors);

  if (errors.length > 0) {
    throw new Error(
      `OpenAPI document validation failed:\n- ${errors.join('\n- ')}`,
    );
  }
}
