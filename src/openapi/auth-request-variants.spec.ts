import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterAccountDto } from '../modules/auth/contracts/register-account.dto';
import { StartGoogleOAuthDto } from '../modules/auth/oauth/oauth.dto';

interface IAuthTestSchema {
  $ref?: string;
  enum?: string[];
  properties?: Record<string, IAuthTestSchema>;
  required?: string[];
  additionalProperties?: boolean;
  oneOf?: IAuthTestSchema[];
}

const contract = JSON.parse(
  readFileSync(join(__dirname, '../../contracts/openapi.json'), 'utf8'),
) as {
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody: {
          content: Record<
            string,
            {
              schema: IAuthTestSchema;
              examples?: Record<string, { value: Record<string, unknown> }>;
            }
          >;
        };
      }
    >
  >;
  components: { schemas: Record<string, IAuthTestSchema> };
};

function matches(schema: IAuthTestSchema, value: unknown): boolean {
  if (schema.$ref) {
    const name = schema.$ref.substring(schema.$ref.lastIndexOf('/') + 1);
    return matches(contract.components.schemas[name], value);
  }
  if (schema.oneOf) {
    return schema.oneOf.filter((branch) => matches(branch, value)).length === 1;
  }
  if (schema.enum) return schema.enum.includes(value as string);
  if (!schema.properties) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const object = value as Record<string, unknown>;
  return (
    (schema.required ?? []).every((key) => object[key] !== undefined) &&
    Object.entries(object).every(
      ([key, item]) =>
        (schema.properties?.[key] !== undefined &&
          matches(schema.properties[key], item)) ||
        schema.additionalProperties !== false,
    )
  );
}

function request(path: string): {
  schema: IAuthTestSchema;
  examples?: Record<string, { value: Record<string, unknown> }>;
} {
  return contract.paths[path].post.requestBody.content['application/json'];
}

describe('auth conditional OpenAPI requests', () => {
  it('does not publish the permissive runtime validation DTOs as public schemas', () => {
    for (const name of [
      'RegisterAccountDto',
      'StartGoogleOAuthDto',
      'BeginEmailChangeDto',
      'BeginMfaDto',
    ]) {
      expect(contract.components.schemas[name]).toBeUndefined();
    }
  });
  it.each([
    ['/api/auth/signup', RegisterAccountDto],
    ['/api/auth/oauth/google/transactions', StartGoogleOAuthDto],
  ])(
    'committed %s examples pass runtime DTO validation',
    async (path, dtoClass) => {
      const body = request(path as string);
      for (const example of Object.values(body.examples ?? {})) {
        const dto = plainToInstance(
          dtoClass as typeof RegisterAccountDto,
          example.value,
        );
        const errors = await validate(dto, {
          whitelist: true,
          forbidNonWhitelisted: true,
        });
        expect(errors).toEqual([]);
      }
    },
  );
  it.each([
    '/api/auth/signup',
    '/api/auth/oauth/google/transactions',
    '/api/auth/me/email-change/request',
    '/api/auth/2fa/enable',
  ])('publishes only schema-valid labelled examples for %s', (path) => {
    const body = request(path);
    expect(body.schema.oneOf).toHaveLength(
      Object.keys(body.examples ?? {}).length,
    );
    for (const example of Object.values(body.examples ?? {})) {
      expect(matches(body.schema, example.value)).toBe(true);
    }
  });

  it('forbids organization details for persona signup and requires them for organization signup', () => {
    const body = request('/api/auth/signup');
    const patient = body.examples!.patient.value;
    const hospital = body.examples!.hospital.value;
    expect(
      matches(body.schema, { ...patient, organization: hospital.organization }),
    ).toBe(false);
    expect(matches(body.schema, { ...hospital, organization: undefined })).toBe(
      false,
    );
    expect(
      matches(body.schema, {
        ...hospital,
        organization: {
          ...(hospital.organization as object),
          organization_type: 'pharmacy',
        },
      }),
    ).toBe(false);
  });

  it('forbids link, organization intents, and signup fields during Google sign-in', () => {
    const body = request('/api/auth/oauth/google/transactions');
    const signIn = body.examples!.signin.value;
    expect(matches(body.schema, { ...signIn, operation: 'link' })).toBe(false);
    expect(matches(body.schema, { ...signIn, intent: 'patient' })).toBe(false);
    expect(
      matches(body.schema, { ...signIn, accepted_terms_version: 'v1' }),
    ).toBe(false);
    expect(
      matches(body.schema, {
        ...signIn,
        operation: 'signup',
        intent: 'hospital',
      }),
    ).toBe(false);
  });

  it('requires the step-up fields on the named email and MFA branches', () => {
    const email = request('/api/auth/me/email-change/request');
    const passwordMfa =
      contract.components.schemas.PasswordMfaEmailChangeRequest;
    const passwordMfaExample =
      email.examples!.PasswordMfaEmailChangeRequest.value;
    expect(matches(passwordMfa, passwordMfaExample)).toBe(true);
    expect(
      matches(passwordMfa, { ...passwordMfaExample, mfa_code: undefined }),
    ).toBe(false);
    expect(
      matches(passwordMfa, {
        ...passwordMfaExample,
        current_password: undefined,
      }),
    ).toBe(false);

    const reenrollment = contract.components.schemas.MfaReenrollmentRequest;
    const mfaExample = request('/api/auth/2fa/enable').examples!.reenrollment
      .value;
    expect(matches(reenrollment, mfaExample)).toBe(true);
    expect(matches(reenrollment, { password: mfaExample.password })).toBe(
      false,
    );
  });

  it('does not require compatibility fields that runtime omits', () => {
    for (const name of [
      'LoginResponseDto',
      'RefreshTokenResponseDto',
      'LogoutResponseDto',
    ]) {
      const schema = contract.components.schemas[name];
      expect(schema.properties).not.toHaveProperty('status_code');
      expect(schema.required).not.toContain('status_code');
    }
  });
});
