import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Schema = { $ref?: string; allOf?: Schema[]; oneOf?: Schema[] };
type Response = {
  content?: Record<
    string,
    {
      schema?: Schema;
      examples?: Record<
        string,
        { value: { data?: Record<string, unknown> | null } }
      >;
    }
  >;
};
type Operation = { responses: Record<string, Response> };

const contract = JSON.parse(
  readFileSync(join(__dirname, '../../contracts/openapi.json'), 'utf8'),
) as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
};

const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const stableErrorSchemas = new Set([
  'ApiErrorResponseDto',
  'AuthChallengeErrorResponseDto',
  'OAuthErrorResponseDto',
]);

function schemaRefs(schema: Schema): string[] {
  return [
    ...(schema.$ref ? [schema.$ref] : []),
    ...(schema.allOf?.flatMap(schemaRefs) ?? []),
    ...(schema.oneOf?.flatMap(schemaRefs) ?? []),
  ];
}

function schemaName(ref: string): string {
  return ref.substring(ref.lastIndexOf('/') + 1);
}

describe('canonical public authentication contract', () => {
  it('publishes distinct mobile and browser continuation examples without browser refresh JSON', () => {
    const mobile =
      contract.paths['/api/auth/oauth/google/complete'].post.responses;
    const browser =
      contract.paths['/api/auth/browser/oauth/google/complete'].post.responses;
    expect(
      Object.keys(mobile['200'].content?.['application/json'].examples ?? {}),
    ).toEqual(['mfa', 'session']);
    expect(
      Object.keys(mobile['202'].content?.['application/json'].examples ?? {}),
    ).toEqual(['contact']);
    expect(
      Object.keys(browser['200'].content?.['application/json'].examples ?? {}),
    ).toEqual(['link', 'mfa', 'session']);
    expect(
      Object.keys(browser['202'].content?.['application/json'].examples ?? {}),
    ).toEqual(['contact']);
    const mobileSession =
      mobile['200'].content?.['application/json'].examples?.session.value.data;
    const browserSession =
      browser['200'].content?.['application/json'].examples?.session.value.data;
    expect(mobileSession).toHaveProperty('refresh_token');
    expect(browserSession).not.toHaveProperty('refresh_token');
    expect(browserSession).toHaveProperty('access_token');
  });
  it('documents professional profile persona denial', () => {
    const operation = contract.paths['/api/auth/me/professional-profile'].patch;
    expect(
      operation.responses['403'].content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/ApiErrorResponseDto',
    });
  });

  const operations = Object.entries(contract.paths).flatMap(([path, item]) =>
    path.startsWith('/api/auth/')
      ? Object.entries(item)
          .filter(([method]) => methods.has(method))
          .map(([method, operation]) => ({ path, method, operation }))
      : [],
  );

  it('includes the complete public auth surface', () => {
    expect(operations.length).toBeGreaterThanOrEqual(30);
    expect(operations.map(({ path }) => path)).toContain('/api/auth/signup');
    expect(operations.map(({ path }) => path)).toContain(
      '/api/auth/oauth/google/complete',
    );
    expect(operations.map(({ path }) => path)).toContain(
      '/api/auth/browser/refresh',
    );
    expect(operations.map(({ path }) => path)).toContain(
      '/api/auth/2fa/confirm',
    );
  });

  it.each(operations)(
    '$method $path has typed success and stable error responses',
    ({ operation }) => {
      const responses = Object.entries(operation.responses);
      const success = responses.filter(([status]) => /^2\d\d$/.test(status));
      const errors = responses.filter(([status]) => /^[45]\d\d$/.test(status));

      expect(success.length).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThan(0);

      for (const [status, response] of responses) {
        const schema = response.content?.['application/json']?.schema;
        expect(schema).toBeDefined();
        const refs = schemaRefs(schema!);
        expect(refs.length).toBeGreaterThan(0);
        for (const ref of refs) {
          expect(ref).toMatch(/^#\/components\/schemas\/[A-Za-z0-9_]+$/);
          expect(contract.components.schemas[schemaName(ref)]).toBeDefined();
        }
        expect(
          !/^[45]\d\d$/.test(status) ||
            refs.some((ref) => stableErrorSchemas.has(schemaName(ref))),
        ).toBe(true);
      }
    },
  );
});
