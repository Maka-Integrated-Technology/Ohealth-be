#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';
import prettier from 'prettier';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const CONTRACT_PATH = resolve(REPOSITORY_ROOT, 'contracts/openapi.json');
const GENERATED_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  'packages/api-client/src/generated',
);
const GENERATED_SCHEMA_PATH = resolve(GENERATED_DIRECTORY, 'schema.ts');
const GENERATED_CLIENT_PATH = resolve(GENERATED_DIRECTORY, 'client.ts');
const HTTP_METHODS = new Set([
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
]);
const GENERATED_BANNER = `/**
 * Generated from contracts/openapi.json. Do not edit manually.
 * Regenerate with: npm run api-client:generate
 */

`;

const fail = (message) => {
  throw new Error(`API client generation failed: ${message}`);
};

const readContract = async () => {
  const source = await readFile(CONTRACT_PATH, 'utf8');
  const contract = JSON.parse(source);

  if (
    typeof contract !== 'object' ||
    contract === null ||
    typeof contract.paths !== 'object' ||
    contract.paths === null
  ) {
    fail('the canonical contract does not contain a paths object');
  }

  return contract;
};

const decodeReferenceToken = (token) =>
  token.replaceAll('~1', '/').replaceAll('~0', '~');

const resolveReference = (contract, value) => {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.$ref !== 'string'
  ) {
    return value;
  }

  if (!value.$ref.startsWith('#/')) {
    fail(`external reference is not allowed: ${value.$ref}`);
  }

  let resolved = contract;
  for (const token of value.$ref
    .slice(2)
    .split('/')
    .map(decodeReferenceToken)) {
    resolved = resolved?.[token];
  }

  if (resolved === undefined) {
    fail(`unresolved reference: ${value.$ref}`);
  }

  return resolved;
};

const propertyAccess = (property) => `[${JSON.stringify(property)}]`;

const responseStatusAccess = (status) => {
  return /^\d+$/.test(status) ? `[${status}]` : propertyAccess(status);
};

const operationType = (operationId) => {
  return `operations${propertyAccess(operationId)}`;
};

const responseType = (contract, operation, operationId, statuses) => {
  if (statuses.length === 0) {
    return 'unknown';
  }

  const variants = [];
  for (const status of statuses) {
    const unresolvedResponse = operation.responses[status];
    const response = resolveReference(contract, unresolvedResponse);
    const content = response?.content;

    if (
      typeof content !== 'object' ||
      content === null ||
      Object.keys(content).length === 0
    ) {
      variants.push('undefined');
      continue;
    }

    for (const mediaType of Object.keys(content).sort()) {
      variants.push(
        `${operationType(operationId)}["responses"]${responseStatusAccess(
          status,
        )}["content"]${propertyAccess(mediaType)}`,
      );
    }
  }

  return [...new Set(variants)].join(' | ');
};

const mergeParameters = (contract, pathItem, operation) => {
  const parameters = new Map();

  for (const unresolvedParameter of [
    ...(pathItem.parameters ?? []),
    ...(operation.parameters ?? []),
  ]) {
    const parameter = resolveReference(contract, unresolvedParameter);
    if (
      typeof parameter?.name !== 'string' ||
      typeof parameter?.in !== 'string'
    ) {
      fail('operation contains an invalid parameter');
    }

    parameters.set(`${parameter.in}:${parameter.name}`, parameter);
  }

  return [...parameters.values()];
};

const requestShape = (contract, pathItem, operation, operationId) => {
  const parameters = mergeParameters(contract, pathItem, operation);
  const groups = [
    ['path', 'path'],
    ['query', 'query'],
    ['header', 'headerParameters'],
    ['cookie', 'cookies'],
  ];
  const fields = [];
  let hasRequiredInput = false;

  for (const [location, fieldName] of groups) {
    const matchingParameters = parameters.filter(
      (parameter) => parameter.in === location,
    );
    if (matchingParameters.length === 0) {
      continue;
    }

    const required =
      location === 'path' ||
      matchingParameters.some((parameter) => parameter.required === true);
    hasRequiredInput ||= required;
    fields.push(
      `  readonly ${fieldName}${required ? '' : '?'}: NonNullable<${operationType(
        operationId,
      )}["parameters"]${propertyAccess(location)}>;`,
    );
  }

  let requestMediaType;
  if (operation.requestBody !== undefined) {
    const requestBody = resolveReference(contract, operation.requestBody);
    const mediaTypes = Object.keys(requestBody?.content ?? {}).sort();
    if (mediaTypes.length === 0) {
      fail(`${operationId} has a request body without media content`);
    }
    if (mediaTypes.length > 1) {
      fail(`${operationId} has multiple request media types`);
    }

    [requestMediaType] = mediaTypes;
    const required = requestBody.required === true;
    hasRequiredInput ||= required;
    fields.push(
      `  readonly body${required ? '' : '?'}: NonNullable<${operationType(
        operationId,
      )}["requestBody"]>["content"]${propertyAccess(requestMediaType)};`,
    );
  }

  fields.push('  readonly headers?: ApiHeaders;');

  return {
    hasRequiredInput,
    requestMediaType,
    type: `Readonly<{\n${fields.join('\n')}\n}>`,
  };
};

const collectOperations = (contract) => {
  const collected = [];
  const operationIds = new Set();

  for (const [path, unresolvedPathItem] of Object.entries(contract.paths)) {
    const pathItem = resolveReference(contract, unresolvedPathItem);

    for (const [method, unresolvedOperation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }

      const operation = resolveReference(contract, unresolvedOperation);
      const operationId = operation?.operationId;
      if (
        typeof operationId !== 'string' ||
        !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(operationId)
      ) {
        fail(`${method.toUpperCase()} ${path} has an invalid operationId`);
      }
      if (operationIds.has(operationId)) {
        fail(`duplicate operationId: ${operationId}`);
      }
      if (
        typeof operation.responses !== 'object' ||
        operation.responses === null
      ) {
        fail(`${operationId} does not define responses`);
      }

      operationIds.add(operationId);
      const statuses = Object.keys(operation.responses).sort();
      const successStatuses = statuses.filter((status) =>
        /^2(?:\d\d|XX)$/.test(status),
      );
      const errorStatuses = statuses.filter(
        (status) => !successStatuses.includes(status),
      );
      if (successStatuses.length === 0) {
        fail(`${operationId} does not define a successful response`);
      }

      collected.push({
        operationId,
        method: method.toUpperCase(),
        path,
        request: requestShape(contract, pathItem, operation, operationId),
        responseType: responseType(
          contract,
          operation,
          operationId,
          successStatuses,
        ),
        errorType: responseType(
          contract,
          operation,
          operationId,
          errorStatuses,
        ),
      });
    }
  }

  return collected.sort((left, right) =>
    left.operationId.localeCompare(right.operationId),
  );
};

const generateSchema = async (contract) => {
  const nodes = await openapiTS(contract, {
    alphabetize: true,
    dedupeEnums: true,
    enum: true,
    immutable: true,
    silent: true,
  });

  return `${GENERATED_BANNER}${astToString(nodes)}`;
};

const generateClient = (contract) => {
  const operations = collectOperations(contract);
  const aliases = operations
    .map(
      (operation) => `export type ${operation.operationId}Request =
${operation.request.type};
export type ${operation.operationId}Response =
  ${operation.responseType};
export type ${operation.operationId}Error =
  ${operation.errorType};`,
    )
    .join('\n\n');
  const interfaceMembers = operations
    .map((operation) => {
      const optional = operation.request.hasRequiredInput ? '' : '?';
      return `  readonly ${operation.operationId}: (
    request${optional}: ${operation.operationId}Request,
  ) => Promise<${operation.operationId}Response>;`;
    })
    .join('\n');
  const implementations = operations
    .map((operation) => {
      const requestArgument = operation.request.hasRequiredInput
        ? 'request'
        : 'request = {}';
      const mediaType = operation.request.requestMediaType
        ? `,\n        requestMediaType: ${JSON.stringify(
            operation.request.requestMediaType,
          )}`
        : '';

      return `    ${operation.operationId}: (${requestArgument}) =>
      core.request<
        ${operation.operationId}Response,
        ${operation.operationId}Error
      >(
        {
          operationId: ${JSON.stringify(operation.operationId)},
          method: ${JSON.stringify(operation.method)},
          path: ${JSON.stringify(operation.path)}${mediaType},
        },
        request,
      ),`;
    })
    .join('\n');

  return `${GENERATED_BANNER}import { createCoreClient } from '../core/client.js';
import type { ApiClientConfig, ApiHeaders } from '../core/types.js';
import type { operations } from './schema.js';

${aliases}

export interface ApiClient {
${interfaceMembers}
}

export const createApiClient = (config: ApiClientConfig): ApiClient => {
  const core = createCoreClient(config);

  return {
${implementations}
  };
};
`;
};

const formatTypeScript = (source) => {
  return prettier.format(source, {
    parser: 'typescript',
    singleQuote: true,
  });
};

const generateArtifacts = async () => {
  const contract = await readContract();
  const schema = await generateSchema(contract);
  const client = generateClient(contract);
  return new Map([
    [GENERATED_SCHEMA_PATH, await formatTypeScript(schema)],
    [GENERATED_CLIENT_PATH, await formatTypeScript(client)],
  ]);
};

const assertDeterministic = async (artifacts) => {
  const repeated = await generateArtifacts();
  for (const [path, content] of artifacts) {
    if (repeated.get(path) !== content) {
      fail(`generation is not deterministic for ${path}`);
    }
  }
};

const checkArtifacts = async (artifacts) => {
  const stale = [];
  for (const [path, expected] of artifacts) {
    const actual = await readFile(path, 'utf8').catch(() => undefined);
    if (actual !== expected) {
      stale.push(path);
    }
  }

  if (stale.length > 0) {
    for (const path of stale) {
      console.error(`Generated API client file is stale: ${path}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Generated API client is current and deterministic.');
};

const writeArtifacts = async (artifacts) => {
  await mkdir(GENERATED_DIRECTORY, { recursive: true });
  for (const [path, content] of artifacts) {
    await writeFile(path, content, 'utf8');
    console.log(`Generated ${path}`);
  }
};

const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') {
  console.error(
    'Usage: node scripts/api-client/generate-api-client.mjs --check|--write',
  );
  process.exit(2);
}

const artifacts = await generateArtifacts();
await assertDeterministic(artifacts);

if (mode === '--check') {
  await checkArtifacts(artifacts);
} else {
  await writeArtifacts(artifacts);
}
