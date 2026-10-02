import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ApiClientError, createApiClient } from '../../dist/index.js';

test('emits no type-only or platform-specific runtime imports', async () => {
  const runtimePaths = [
    '../../dist/index.js',
    '../../dist/core/api-client-error.js',
    '../../dist/core/client.js',
    '../../dist/core/types.js',
    '../../dist/generated/client.js',
    '../../dist/generated/schema.js',
  ];
  const runtimeSources = await Promise.all(
    runtimePaths.map((runtimePath) =>
      readFile(new URL(runtimePath, import.meta.url), 'utf8'),
    ),
  );
  const generatedClient = runtimeSources[4];
  const packageRuntime = runtimeSources.join('\n');

  assert.doesNotMatch(generatedClient, /schema\.js|core\/types\.js/);
  assert.doesNotMatch(
    packageRuntime,
    /node:|from ['"]react['"]|\bwindow\b|\bdocument\b|\bfetch\s*\(/,
  );
});

test('exposes every canonical operationId exactly once', async () => {
  const contract = JSON.parse(
    await readFile(
      new URL('../../../../contracts/openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const operationIds = Object.values(contract.paths)
    .flatMap((pathItem) => Object.values(pathItem))
    .filter(
      (operation) =>
        typeof operation === 'object' &&
        operation !== null &&
        typeof operation.operationId === 'string',
    )
    .map((operation) => operation.operationId)
    .sort();
  const client = createApiClient({
    baseUrl: 'https://api.ohealth.example',
    transport: async () => ({ status: 200, data: {} }),
  });

  assert.equal(operationIds.length, 91);
  assert.deepEqual(Object.keys(client).sort(), operationIds);
});

test('uses injected transport and resolves current authorization headers', async () => {
  const requests = [];
  let accessToken = 'first-token';
  const client = createApiClient({
    baseUrl: 'https://api.ohealth.example/',
    getHeaders: () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    transport: async (request) => {
      requests.push(request);
      return {
        status: 200,
        data: { ok: true },
      };
    },
  });

  await client.AuthController_activateAccount({
    path: { user_id: 'user/42' },
    headers: { 'X-Request-ID': 'request-1' },
  });
  accessToken = 'second-token';
  await client.AuthController_getProfile();

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], {
    operationId: 'AuthController_activateAccount',
    method: 'PATCH',
    url: 'https://api.ohealth.example/api/auth/users/user%2F42/activate',
    headers: {
      Authorization: 'Bearer first-token',
      'X-Request-ID': 'request-1',
    },
    query: undefined,
    cookies: undefined,
    body: undefined,
    mediaType: undefined,
  });
  assert.equal(requests[1].headers.Authorization, 'Bearer second-token');
});

test('passes request bodies and media type metadata to the transport', async () => {
  let capturedRequest;
  const client = createApiClient({
    baseUrl: '/api',
    transport: async (request) => {
      capturedRequest = request;
      return {
        status: 200,
        data: { access_token: 'token' },
      };
    },
  });

  await client.AuthController_login({
    body: {
      email: 'person@example.com',
      password: 'SecurePassword123!',
    },
  });

  assert.equal(capturedRequest.url, '/api/api/auth/login');
  assert.equal(capturedRequest.mediaType, 'application/json');
  assert.deepEqual(capturedRequest.body, {
    email: 'person@example.com',
    password: 'SecurePassword123!',
  });
});

test('preserves the backend error response envelope', async () => {
  const envelope = {
    status_code: 403,
    message: 'Forbidden resource',
    error: 'Forbidden',
    data: null,
  };
  const client = createApiClient({
    baseUrl: 'https://api.ohealth.example',
    transport: async () => ({
      status: 403,
      data: envelope,
      headers: { 'x-request-id': 'request-2' },
    }),
  });

  await assert.rejects(client.AuthController_getProfile(), (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 403);
    assert.equal(error.response, envelope);
    assert.deepEqual(error.headers, {
      'x-request-id': 'request-2',
    });
    return true;
  });
});

test('rejects invalid configuration and missing path parameters', async () => {
  assert.throws(
    () =>
      createApiClient({
        baseUrl: ' ',
        transport: async () => ({ status: 200, data: {} }),
      }),
    /base URL must not be empty/,
  );

  const client = createApiClient({
    baseUrl: 'https://api.ohealth.example',
    transport: async () => ({ status: 200, data: {} }),
  });
  await assert.rejects(
    client.AuthController_activateAccount({}),
    /Missing path parameter: user_id/,
  );
});
