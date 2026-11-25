import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const id = '550e8400-e29b-41d4-a716-446655440000';
const timestamp = '2030-01-01T00:00:00.000Z';
const created = '2026-01-01T00:00:00.000Z';
const context = {
  active_organization_id: null,
  account: {
    id,
    email: 'person@example.com',
    first_name: 'Example',
    last_name: 'Person',
    status: 'active',
    email_verified: true,
    created_at: created,
    profile: {
      middle_name: null,
      gender: null,
      dob: null,
      phone: null,
      country: null,
      image: null,
      updated_at: created,
    },
  },
  personas: [{ type: 'patient', is_active: true }],
  professional: null,
  memberships: [],
  capabilities: [],
  session: { id, expires_at: timestamp, last_used_at: null },
};

const envelope = (message: string, data: object | null, statusCode = 200) => ({
  status_code: statusCode,
  message,
  data,
});

const mobileSession = envelope('login success', {
  access_token: 'ACCESS_TOKEN_PLACEHOLDER',
  refresh_token: 'REFRESH_TOKEN_PLACEHOLDER',
  account_context: context,
  session_id: id,
  session_expires_at: timestamp,
});
const browserSession = envelope('login success', {
  access_token: 'ACCESS_TOKEN_PLACEHOLDER',
  account_context: context,
  session_id: id,
  session_expires_at: timestamp,
});
const mfaChallenge = envelope('MFA verification required.', {
  mfa_challenge_id: id,
  expires_in_seconds: 600,
});
const contactChallenge = envelope(
  'Contact verification required.',
  {
    challenge_id: id,
    resend_after_seconds: 60,
    expires_in_seconds: 600,
    error_code: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
  },
  202,
);

type Example = { summary: string; value: object };

function examples(
  document: OpenAPIObject,
  path: string,
  status: number,
  entries: Record<string, Example>,
): void {
  const response = document.paths[path]?.post?.responses[String(status)];
  if (!response || '$ref' in response)
    throw new Error(`Missing ${status} ${path}`);
  const json = response.content?.['application/json'];
  if (!json) throw new Error(`Missing JSON ${status} ${path}`);
  json.examples = entries;
}

/** Illustrative, credential-free examples of every externally visible auth continuation. */
export function addAuthResponseExamples(document: OpenAPIObject): void {
  examples(document, '/api/auth/login/verify', 200, {
    session: { summary: 'Mobile session issued', value: mobileSession },
    mfa: { summary: 'Continue with MFA', value: mfaChallenge },
  });
  examples(document, '/api/auth/browser/login/verify', 200, {
    session: {
      summary: 'Browser session issued; refresh credential in Set-Cookie',
      value: browserSession,
    },
    mfa: {
      summary: 'Continue with MFA; no refresh cookie',
      value: mfaChallenge,
    },
  });
  examples(document, '/api/auth/oauth/google/complete', 200, {
    session: {
      summary: 'Mobile session issued',
      value: { ...mobileSession, message: 'Login successful' },
    },
    mfa: { summary: 'Continue with MFA', value: mfaChallenge },
  });
  examples(document, '/api/auth/oauth/google/complete', 202, {
    contact: {
      summary: 'Continue with contact verification',
      value: contactChallenge,
    },
  });
  examples(document, '/api/auth/browser/oauth/google/complete', 200, {
    session: {
      summary: 'Browser session issued; refresh credential in Set-Cookie',
      value: { ...browserSession, message: 'Login successful' },
    },
    mfa: {
      summary: 'Continue with MFA; no refresh cookie',
      value: mfaChallenge,
    },
    link: {
      summary: 'Google authenticator linked; no new session',
      value: envelope('Google identity linked.', null),
    },
  });
  examples(document, '/api/auth/browser/oauth/google/complete', 202, {
    contact: {
      summary: 'Continue with contact verification',
      value: contactChallenge,
    },
  });
}
