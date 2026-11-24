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

  assert.equal(operationIds.length, 124);
  assert.deepEqual(Object.keys(client).sort(), operationIds);
});

test('exports the public discovery enums under their contract names', async () => {
  const exported = await import('../../dist/index.js');

  assert.deepEqual(Object.values(exported.ConsultationType), [
    'chat',
    'video',
    'both',
  ]);
  assert.deepEqual(Object.values(exported.PublicProfessionalSortField), [
    'rating',
    'experience',
    'consultation_fee',
    'name',
  ]);
  // A query parameter that inlines an enum instead of referencing its named
  // schema renames the export after the path.
  assert.deepEqual(
    Object.keys(exported).filter((name) => name.startsWith('PathsApiPublic')),
    [],
  );
});

test('requests public availability for one professional over a calendar date range', async () => {
  const requests = [];
  const client = createApiClient({
    baseUrl: 'https://api.ohealth.example',
    transport: async (request) => {
      requests.push(request);
      return { status: 200, data: {} };
    },
  });

  await client.PublicProfessionalController_findAvailability({
    path: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
    query: { from: '2026-01-15', to: '2026-01-21' },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  assert.equal(
    requests[0].url,
    'https://api.ohealth.example/api/public/professionals/3f2504e0-4f89-41d3-9a0c-0305e82c3301/availability',
  );
  assert.deepEqual(requests[0].query, { from: '2026-01-15', to: '2026-01-21' });
  assert.equal(requests[0].body, undefined);
});

test('describes every public slot by its time zone and instants', async () => {
  const contract = JSON.parse(
    await readFile(
      new URL('../../../../contracts/openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const operation =
    contract.paths['/api/public/professionals/{id}/availability'].get;
  const slot = contract.components.schemas.PublicAvailabilitySlotDto;
  const day = contract.components.schemas.PublicAvailabilityDayDto;
  const availability =
    contract.components.schemas.PublicProfessionalAvailabilityDto;
  const range = Object.fromEntries(
    operation.parameters
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => [parameter.name, parameter]),
  );

  // The range is two required calendar dates; an optional opaque cursor
  // continues it, and the response says where the next page starts.
  assert.deepEqual(Object.keys(range).sort(), ['cursor', 'from', 'to']);
  for (const bound of [range.from, range.to]) {
    assert.equal(bound.required, true);
    assert.equal(bound.schema.format, 'date');
  }
  assert.equal(range.cursor.required, false);
  assert.ok(availability.required.includes('next_cursor'));
  assert.equal(availability.properties.next_cursor.nullable, true);

  // A local time is never published without the zone it is local to and the
  // instant it resolves to.
  assert.deepEqual([...slot.required].sort(), [
    'end_time',
    'ends_at',
    'id',
    'start_time',
    'starts_at',
    'time_zone',
  ]);
  assert.match(slot.properties.time_zone.description, /IANA time zone/);
  assert.equal(slot.properties.starts_at.format, 'date-time');
  assert.equal(slot.properties.ends_at.format, 'date-time');
  assert.equal(day.properties.date.format, 'date');
  assert.equal(availability.properties.as_of.format, 'date-time');

  // The contract says a listed slot is not a reservation.
  for (const text of [operation.description, availability.description]) {
    assert.match(text, /booking creation revalidates/);
    assert.match(text, /not a reservation/);
  }
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

  await client.BookingController_findOne({
    path: { id: 'booking/42' },
    headers: { 'X-Request-ID': 'request-1' },
  });
  accessToken = 'second-token';
  await client.AuthController_getProfile();

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], {
    operationId: 'BookingController_findOne',
    method: 'GET',
    url: 'https://api.ohealth.example/api/bookings/booking%2F42',
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

test('keeps browser refresh distinct and credential-free in generated input', async () => {
  let capturedRequest;
  const client = createApiClient({
    baseUrl: 'https://api.ohealth.example',
    transport: async (request) => {
      capturedRequest = request;
      return { status: 200, data: { access_token: 'token' } };
    },
  });

  await client.BrowserSessionController_refresh({
    headerParameters: { 'X-OHealth-Client': 'browser' },
  });

  assert.equal(capturedRequest.operationId, 'BrowserSessionController_refresh');
  assert.deepEqual(capturedRequest.headers, {
    'X-OHealth-Client': 'browser',
  });
  assert.equal(capturedRequest.body, undefined);
  assert.equal(capturedRequest.cookies, undefined);
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
    client.BookingController_findOne({}),
    /Missing path parameter: id/,
  );
});
