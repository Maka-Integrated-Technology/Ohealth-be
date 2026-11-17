import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Schema = { $ref?: string; allOf?: Schema[]; oneOf?: Schema[] };
type Response = { content?: Record<string, { schema?: Schema }> };
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
    ({ path, operation }) => {
      const responses = Object.entries(operation.responses);
      const success = responses.filter(([status]) => /^2\d\d$/.test(status));
      const errors = responses.filter(([status]) => /^[45]\d\d$/.test(status));

      // The retired legacy Google endpoint deliberately exposes only HTTP 410.
      expect(path === '/api/auth/google-login' || success.length > 0).toBe(
        true,
      );
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
