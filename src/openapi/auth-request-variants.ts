import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const ref = (name: string): ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});

function component(document: OpenAPIObject, name: string): SchemaObject {
  const value = document.components.schemas?.[name];
  if (!value || '$ref' in value) {
    throw new Error(`Missing auth request component ${name}`);
  }
  return value;
}

function request(document: OpenAPIObject, path: string): OperationObject {
  const operation = document.paths[path]?.post;
  if (!operation) throw new Error(`Missing auth operation ${path}`);
  return operation;
}

function replaceRequest(
  operation: OperationObject,
  alternatives: string[],
  description: string,
  examples?: Record<
    string,
    { summary: string; description: string; value: object }
  >,
): void {
  const body = operation.requestBody;
  if (!body || '$ref' in body) throw new Error('Missing auth request body');
  body.description = description;
  body.content['application/json'].schema = {
    oneOf: alternatives.map(ref),
  };
  if (examples) body.content['application/json'].examples = examples;
}

const legalExample = {
  accepted_terms_version: 'TERMS_VERSION_FROM_BOOTSTRAP',
  accepted_privacy_version: 'PRIVACY_VERSION_FROM_BOOTSTRAP',
};
const legalExampleDescription =
  'Before sending, replace the two version markers with terms.version and privacy.version from GET /api/auth/registration/bootstrap.';

/** Contract-only alternatives for the runtime's conditional DTO validation. */
export function addAuthRequestVariants(document: OpenAPIObject): void {
  component(document, 'OrganizationRegistrationDto').additionalProperties =
    false;
  const signup = component(document, 'RegisterAccountDto');
  const signupProperties = { ...signup.properties };
  delete signupProperties.organization;
  const signupRequired = (signup.required ?? []).filter(
    (field) => field !== 'organization',
  );
  const intents = [
    ['patient', 'PatientSignupRequest'],
    ['healthcare_professional', 'ProfessionalSignupRequest'],
    ['hospital', 'HospitalSignupRequest'],
    ['laboratory', 'LaboratorySignupRequest'],
    ['pharmacy', 'PharmacySignupRequest'],
  ] as const;
  for (const [intent, name] of intents) {
    const organization = !['patient', 'healthcare_professional'].includes(
      intent,
    );
    document.components.schemas[name] = {
      type: 'object',
      description:
        intent === 'healthcare_professional'
          ? 'Independent professional signup. Organization membership is acquired later.'
          : `${intent} registration. The server derives the organization type from intent.`,
      additionalProperties: false,
      properties: {
        ...signupProperties,
        intent: { type: 'string', enum: [intent] },
        ...(organization
          ? { organization: signup.properties?.organization }
          : {}),
      },
      required: organization
        ? [...signupRequired, 'organization']
        : signupRequired,
    };
  }
  replaceRequest(
    request(document, '/api/auth/signup'),
    intents.map(([, name]) => name),
    'Choose exactly one intent. Copy accepted_terms_version and accepted_privacy_version from GET /api/auth/registration/bootstrap immediately before signup. Persona signup forbids organization; organization signup requires it.',
    Object.fromEntries(
      intents.map(([intent]) => [
        intent,
        {
          summary: `${intent} signup`,
          description: legalExampleDescription,
          value: {
            first_name: 'Example',
            last_name: 'Person',
            email: 'person@example.com',
            password: 'Synthetic example passphrase 2026!',
            intent,
            ...legalExample,
            ...(!['patient', 'healthcare_professional'].includes(intent)
              ? {
                  organization: {
                    name: 'Example Organization',
                    registration_number: 'EXAMPLE-001',
                    location: 'Example location',
                    contact_email: 'organization@example.com',
                  },
                }
              : {}),
          },
        },
      ]),
    ),
  );

  const oauth = component(document, 'StartGoogleOAuthDto');
  const oauthProperties = oauth.properties ?? {};
  const oauthCommon = {
    consumer: oauthProperties.consumer,
    audience: oauthProperties.audience,
  };
  const oauthVariants = [
    ['signin', undefined, 'GoogleSignInTransactionRequest'],
    ['signup', 'patient', 'GooglePatientSignupTransactionRequest'],
    [
      'signup',
      'healthcare_professional',
      'GoogleProfessionalSignupTransactionRequest',
    ],
  ] as const;
  for (const [operation, intent, name] of oauthVariants) {
    document.components.schemas[name] = {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...oauthCommon,
        operation: { type: 'string', enum: [operation] },
        ...(intent
          ? {
              intent: { type: 'string', enum: [intent] },
              accepted_terms_version: oauthProperties.accepted_terms_version,
              accepted_privacy_version:
                oauthProperties.accepted_privacy_version,
            }
          : {}),
      },
      required: intent
        ? [
            'consumer',
            'audience',
            'operation',
            'intent',
            'accepted_terms_version',
            'accepted_privacy_version',
          ]
        : ['consumer', 'audience', 'operation'],
    };
  }
  replaceRequest(
    request(document, '/api/auth/oauth/google/transactions'),
    oauthVariants.map(([, , name]) => name),
    'Start sign-in or patient/professional signup only. Use the authenticated /api/auth/oauth/google/link/transactions endpoint for linking. Signup legal versions must come from GET /api/auth/registration/bootstrap; sign-in forbids intent and legal versions.',
    Object.fromEntries(
      oauthVariants.map(([operation, intent]) => [
        intent ?? 'signin',
        {
          summary: intent ? `Google ${intent} signup` : 'Google sign-in',
          description: intent
            ? `${legalExampleDescription} Replace audience with a configured Google client ID.`
            : 'Replace audience with a configured Google client ID.',
          value: {
            operation,
            consumer: 'web',
            audience: 'CONFIGURED_GOOGLE_CLIENT_ID',
            ...(intent ? { intent, ...legalExample } : {}),
          },
        },
      ]),
    ),
  );

  const email = component(document, 'BeginEmailChangeDto');
  const emailProperties = email.properties ?? {};
  const emailVariants = [
    ['PasswordEmailChangeRequest', true, false],
    ['PasswordMfaEmailChangeRequest', true, true],
    ['RecentOAuthEmailChangeRequest', false, false],
    ['RecentOAuthMfaEmailChangeRequest', false, true],
  ] as const;
  for (const [name, password, mfa] of emailVariants) {
    document.components.schemas[name] = {
      type: 'object',
      additionalProperties: false,
      description: password
        ? 'Password-enabled account; current password is required.'
        : 'Passwordless Google account; session must have been created within the last ten minutes.',
      properties: {
        candidate_email: emailProperties.candidate_email,
        ...(password
          ? { current_password: emailProperties.current_password }
          : {}),
        ...(mfa ? { mfa_code: emailProperties.mfa_code } : {}),
      },
      required: [
        'candidate_email',
        ...(password ? ['current_password'] : []),
        ...(mfa ? ['mfa_code'] : []),
      ],
    };
  }
  replaceRequest(
    request(document, '/api/auth/me/email-change/request'),
    emailVariants.map(([name]) => name),
    'Password-enabled accounts require current_password. Passwordless Google accounts require a session created within ten minutes. When MFA is enabled, mfa_code is additionally required and accepts a six-digit TOTP code. Confirmation revokes all sessions.',
    Object.fromEntries(
      emailVariants.map(([name, password, mfa]) => [
        name,
        {
          summary: name.replace(/Request$/, ''),
          description:
            'Replace any proof with the current authenticator before sending.',
          value: {
            candidate_email: 'new-address@example.com',
            ...(password
              ? { current_password: 'Synthetic example passphrase 2026!' }
              : {}),
            ...(mfa ? { mfa_code: '000000' } : {}),
          },
        },
      ]),
    ),
  );

  const mfa = component(document, 'BeginMfaDto');
  document.components.schemas['FirstMfaEnrollmentRequest'] = {
    type: 'object',
    additionalProperties: false,
    properties: { password: mfa.properties?.password },
    required: ['password'],
  };
  document.components.schemas['MfaReenrollmentRequest'] = {
    type: 'object',
    additionalProperties: false,
    properties: {
      password: mfa.properties?.password,
      current_code: mfa.properties?.current_code,
    },
    required: ['password', 'current_code'],
  };
  replaceRequest(
    request(document, '/api/auth/2fa/enable'),
    ['FirstMfaEnrollmentRequest', 'MfaReenrollmentRequest'],
    'First enrollment requires the current password. Re-enrollment of an active factor also requires current_code, a fresh six-digit TOTP code. Recovery codes are accepted only for login MFA continuation.',
    {
      firstEnrollment: {
        summary: 'First MFA enrollment',
        description:
          'Replace the illustrative password with the current password.',
        value: { password: 'Synthetic example passphrase 2026!' },
      },
      reenrollment: {
        summary: 'Re-enroll an active MFA factor',
        description:
          'Replace both illustrative proofs with current credentials.',
        value: {
          password: 'Synthetic example passphrase 2026!',
          current_code: '000000',
        },
      },
    },
  );

  // These runtime validation DTOs are deliberately broader than the public
  // alternatives. Keeping unused flat schemas would still mislead Swagger users.
  for (const name of [
    'RegisterAccountDto',
    'StartGoogleOAuthDto',
    'BeginEmailChangeDto',
    'BeginMfaDto',
  ]) {
    delete document.components.schemas[name];
  }
}
