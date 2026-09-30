# @ohealth/api-client

Framework-neutral TypeScript client generated from the backend-owned
`contracts/openapi.json` contract.

## Public API

The package exposes one root entry point:

- `createApiClient(config)` creates operationId-based endpoint functions.
- `ApiClientError` preserves non-success backend response envelopes.
- Transport, configuration and generated request/response types are exported
  for consumers that need explicit annotations.
- Generated OpenAPI schema types and enums are exported from the same entry
  point.

## Transport integration

The package deliberately does not depend on `fetch`, Axios, React, Node APIs
or React Native APIs. Each consumer injects a transport adapter:

```ts
import { createApiClient, type ApiTransport } from '@ohealth/api-client';

const transport: ApiTransport = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
};

const client = createApiClient({
  baseUrl: 'https://api.ohealth.example',
  transport,
  getHeaders: () => ({
    Authorization: `Bearer ${readCurrentAccessToken()}`,
  }),
});

const profile = await client.AuthController_getProfile();
```

The transport receives the configured base URL, resolved path parameters,
query values, cookies, media type, headers and body as structured values.
Serialization, retries, cancellation, telemetry and platform-specific network
behavior remain consumer-owned.

`getHeaders` is evaluated for every request. The package retains the callback,
not an access token, so web, dashboard and mobile applications continue to own
their authentication state.

## Error handling

For non-2xx responses, the client throws `ApiClientError`. Its `response`
property contains the transport response data unchanged, preserving the
backend error envelope:

```ts
try {
  await client.AuthController_getProfile();
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error(error.status, error.response);
  }
}
```

Transports must return non-2xx responses rather than throwing if consumers need
the package to wrap them in `ApiClientError`.

## Generation and verification

```bash
npm run api-client:generate
npm run api-client:check
npm run api-client:build
npm run api-client:test
```

Files under `src/generated` are generated and carry a warning header. Do not
edit them manually. Files under `src/core` are handwritten adapters and are
kept separate from generated output.

The verification command checks deterministic generation, performs a strict
package build, runs runtime behavior tests, and compiles independent Node,
browser and React Native fixtures.
