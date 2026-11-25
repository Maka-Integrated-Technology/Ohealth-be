import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validators = new Map<string, ValidateFunction>();

/** Translate OpenAPI 3.0 nullable into JSON Schema semantics for AJV. */
function asJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asJsonSchema);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const converted = Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => key !== 'nullable')
      .map(([key, item]) => [key, asJsonSchema(item)]),
  );
  if (source.nullable !== true) return converted;
  if (Object.keys(converted).length === 0) return {};
  return { anyOf: [converted, { type: 'null' }] };
}

export function validateOpenApiExample(
  schemas: Record<string, unknown>,
  schema: object,
  value: unknown,
): { valid: boolean; errors: ErrorObject[] | null } {
  const source = { ...schema, components: { schemas } };
  const key = JSON.stringify(source);
  let validator = validators.get(key);
  if (!validator) {
    validator = ajv.compile(asJsonSchema(source) as object);
    validators.set(key, validator);
  }
  return { valid: Boolean(validator(value)), errors: validator.errors ?? null };
}
