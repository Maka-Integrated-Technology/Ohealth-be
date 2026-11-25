import {
  createApiClient,
  type ApiClient,
  type ApiTransport,
  type components,
  type AuthController_loginRequest,
  type AuthController_loginResponse,
  type PublicProfessionalController_findAvailabilityRequest,
  type AuthController_signupRequest,
  type AuthController_verifyLoginResponse,
  type OAuthController_startRequest,
  type EmailChangeController_beginRequest,
  type TwoFactorAuthController_enable2faRequest,
  GooglePatientSignupTransactionRequestIntent,
  GooglePatientSignupTransactionRequestOperation,
  GooglePatientSignupTransactionRequestConsumer,
  GoogleSignInTransactionRequestOperation,
  HospitalSignupRequestIntent,
  LaboratorySignupRequestIntent,
  PharmacySignupRequestIntent,
  GoogleProfessionalSignupTransactionRequestIntent,
} from '@ohealth/api-client';

const transport: ApiTransport = async () => ({
  status: 200,
  data: {},
});

const client: ApiClient = createApiClient({
  baseUrl: process.env.OHEALTH_API_URL ?? 'http://localhost:3000',
  transport,
  getHeaders: () => ({
    Authorization: `Bearer ${process.env.OHEALTH_ACCESS_TOKEN ?? ''}`,
  }),
});

void client.AuthController_getProfile();
const loginRequest: AuthController_loginRequest = {
  body: {
    email: 'person@example.com',
    password: 'SecurePassword123!',
  },
};
const loginResponse: Promise<AuthController_loginResponse> =
  client.AuthController_login(loginRequest);
void loginResponse;

const patientSignup: AuthController_signupRequest = {
  body: {
    first_name: 'Example',
    last_name: 'Person',
    email: 'person@example.com',
    password: 'Synthetic passphrase 2026!',
    intent: GooglePatientSignupTransactionRequestIntent.patient,
    accepted_terms_version: 'terms-from-bootstrap',
    accepted_privacy_version: 'privacy-from-bootstrap',
  },
};
void patientSignup;

const patientWithOrganization: AuthController_signupRequest = {
  body: {
    ...patientSignup.body,
    // @ts-expect-error Patient signup cannot create an organization.
    organization: {
      name: 'Example',
      registration_number: 'EX-1',
      location: 'Example',
      contact_email: 'org@example.com',
    },
  },
};
void patientWithOrganization;

const hospitalWithoutOrganization: AuthController_signupRequest = {
  // @ts-expect-error Organization registration requires organization details.
  body: {
    ...patientSignup.body,
    intent: HospitalSignupRequestIntent.hospital,
  },
};
void hospitalWithoutOrganization;

const oauthSignIn: OAuthController_startRequest = {
  body: {
    operation: GoogleSignInTransactionRequestOperation.signin,
    consumer: GooglePatientSignupTransactionRequestConsumer.web,
    audience: 'configured-client-id',
  },
};
void oauthSignIn;

const invalidOAuthSignIn: OAuthController_startRequest = {
  body: {
    ...oauthSignIn.body,
    // @ts-expect-error Sign-in does not accept a signup intent.
    intent: GooglePatientSignupTransactionRequestIntent.patient,
  },
};
void invalidOAuthSignIn;

const oauthSignup: OAuthController_startRequest = {
  body: {
    operation: GooglePatientSignupTransactionRequestOperation.signup,
    consumer: GooglePatientSignupTransactionRequestConsumer.mobile,
    audience: 'configured-client-id',
    intent: GooglePatientSignupTransactionRequestIntent.patient,
    accepted_terms_version: 'terms-from-bootstrap',
    accepted_privacy_version: 'privacy-from-bootstrap',
  },
};
void oauthSignup;

const oauthSignupWithoutLegalVersions: OAuthController_startRequest = {
  // @ts-expect-error Google signup requires both current legal versions.
  body: {
    operation: GooglePatientSignupTransactionRequestOperation.signup,
    consumer: GooglePatientSignupTransactionRequestConsumer.mobile,
    audience: 'configured-client-id',
    intent: GooglePatientSignupTransactionRequestIntent.patient,
  },
};
void oauthSignupWithoutLegalVersions;

function handleLoginContinuation(response: AuthController_verifyLoginResponse) {
  const data = response.data;
  if (data && 'mfa_challenge_id' in data) {
    const challengeId: string = data.mfa_challenge_id;
    return challengeId;
  }
  if (data && 'access_token' in data) {
    const accessToken: string = data.access_token;
    const refreshToken: string = data.refresh_token;
    return [accessToken, refreshToken];
  }
  return null;
}
void handleLoginContinuation;

const professionalSignup: AuthController_signupRequest = {
  body: {
    ...patientSignup.body,
    intent:
      GoogleProfessionalSignupTransactionRequestIntent.healthcare_professional,
  },
};
void professionalSignup;

const organization = {
  name: 'Example Organization',
  registration_number: 'EXAMPLE-001',
  location: 'Example location',
  contact_email: 'organization@example.com',
};
const hospitalSignup: AuthController_signupRequest = {
  body: {
    ...patientSignup.body,
    intent: HospitalSignupRequestIntent.hospital,
    organization,
  },
};
const laboratorySignup: AuthController_signupRequest = {
  body: {
    ...patientSignup.body,
    intent: LaboratorySignupRequestIntent.laboratory,
    organization,
  },
};
const pharmacySignup: AuthController_signupRequest = {
  body: {
    ...patientSignup.body,
    intent: PharmacySignupRequestIntent.pharmacy,
    organization,
  },
};
void hospitalSignup;
void laboratorySignup;
void pharmacySignup;

const professionalOAuthSignup: OAuthController_startRequest = {
  body: {
    operation: GooglePatientSignupTransactionRequestOperation.signup,
    consumer: GooglePatientSignupTransactionRequestConsumer.mobile,
    audience: 'configured-client-id',
    intent:
      GoogleProfessionalSignupTransactionRequestIntent.healthcare_professional,
    accepted_terms_version: 'terms-from-bootstrap',
    accepted_privacy_version: 'privacy-from-bootstrap',
  },
};
void professionalOAuthSignup;

const emailChangeBase = { candidate_email: 'new-address@example.com' };
const passwordEmailChange: EmailChangeController_beginRequest = {
  body: { ...emailChangeBase, current_password: 'Synthetic passphrase 2026!' },
};
const passwordMfaEmailChange: EmailChangeController_beginRequest = {
  body: { ...passwordEmailChange.body, mfa_code: '000000' },
};
const recentOAuthEmailChange: EmailChangeController_beginRequest = {
  body: emailChangeBase,
};
const recentOAuthMfaEmailChange: EmailChangeController_beginRequest = {
  body: { ...emailChangeBase, mfa_code: '000000' },
};
void passwordEmailChange;
void passwordMfaEmailChange;
void recentOAuthEmailChange;
void recentOAuthMfaEmailChange;

const firstMfaEnrollment: TwoFactorAuthController_enable2faRequest = {
  body: { password: 'Synthetic passphrase 2026!' },
};
const mfaReenrollment: TwoFactorAuthController_enable2faRequest = {
  body: { password: 'Synthetic passphrase 2026!', current_code: '000000' },
};
void firstMfaEnrollment;
void mfaReenrollment;

const invalidEmailChange: EmailChangeController_beginRequest = {
  body: {
    ...emailChangeBase,
    // @ts-expect-error A six-digit MFA proof is required by this named variant when used.
    mfa_code: 123456,
  },
};
void invalidEmailChange;

const invalidProfessionalSignup: components['schemas']['ProfessionalSignupRequest'] =
  {
    ...professionalSignup.body,
    // @ts-expect-error Professional signup is independent of an organization.
    organization,
  };
void invalidProfessionalSignup;

// @ts-expect-error Laboratory signup requires organization details.
const invalidLaboratory: components['schemas']['LaboratorySignupRequest'] = {
  ...patientSignup.body,
  intent: LaboratorySignupRequestIntent.laboratory,
};
void invalidLaboratory;

// @ts-expect-error Pharmacy signup requires organization details.
const invalidPharmacy: components['schemas']['PharmacySignupRequest'] = {
  ...patientSignup.body,
  intent: PharmacySignupRequestIntent.pharmacy,
};
void invalidPharmacy;

// Named branches preserve the server-dependent step-up conditions.
const missingProfessionalLegal: components['schemas']['GoogleProfessionalSignupTransactionRequest'] =
  {
    operation: GooglePatientSignupTransactionRequestOperation.signup,
    consumer: GooglePatientSignupTransactionRequestConsumer.mobile,
    audience: 'configured-client-id',
    intent:
      GoogleProfessionalSignupTransactionRequestIntent.healthcare_professional,
    // @ts-expect-error Both current legal versions are mandatory for this branch.
    accepted_terms_version: undefined,
    accepted_privacy_version: 'privacy-from-bootstrap',
  };
void missingProfessionalLegal;

// @ts-expect-error Hospital registration cannot omit its organization.
const invalidHospital: components['schemas']['HospitalSignupRequest'] = {
  ...patientSignup.body,
  intent: HospitalSignupRequestIntent.hospital,
};
void invalidHospital;

// @ts-expect-error Password-enabled email change requires current_password.
const missingEmailPassword: components['schemas']['PasswordEmailChangeRequest'] =
  {
    candidate_email: 'new-address@example.com',
  };
void missingEmailPassword;

// @ts-expect-error Passwordless OAuth with MFA requires a fresh TOTP code.
const missingRecentOAuthMfa: components['schemas']['RecentOAuthMfaEmailChangeRequest'] =
  {
    candidate_email: 'new-address@example.com',
  };
void missingRecentOAuthMfa;

// @ts-expect-error MFA step-up requires a six-digit proof in this branch.
const missingEmailMfa: components['schemas']['PasswordMfaEmailChangeRequest'] =
  {
    ...passwordEmailChange.body,
  };
void missingEmailMfa;

// @ts-expect-error Re-enrollment requires the current TOTP proof.
const missingCurrentCode: components['schemas']['MfaReenrollmentRequest'] = {
  password: 'Synthetic passphrase 2026!',
};
void missingCurrentCode;

const invalidFirstEnrollment: components['schemas']['FirstMfaEnrollmentRequest'] =
  {
    password: 'Synthetic passphrase 2026!',
    // @ts-expect-error First enrollment cannot carry a re-enrollment code.
    current_code: '000000',
  };
void invalidFirstEnrollment;

const invalidRecentOAuth: components['schemas']['RecentOAuthEmailChangeRequest'] =
  {
    candidate_email: 'new-address@example.com',
    // @ts-expect-error Passwordless OAuth step-up cannot carry a password.
    current_password: 'Synthetic passphrase 2026!',
  };
void invalidRecentOAuth;

// Public availability takes a pair of required calendar dates, and every slot
// carries the IANA time zone it is local to and its start and end as instants.
const availabilityRequest: PublicProfessionalController_findAvailabilityRequest =
  {
    path: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
    query: { from: '2026-01-15', to: '2026-01-21' },
  };
void client
  .PublicProfessionalController_findAvailability(availabilityRequest)
  .then(({ data }) => {
    const [slot] = data.days[0].slots;
    const zone: string = slot.time_zone;
    const instants: readonly string[] = [
      slot.starts_at,
      slot.ends_at,
      data.as_of,
    ];
    const hasMore: boolean = data.has_more;
    const nextCursor: string | null = data.next_cursor;
    return [zone, instants, hasMore, nextCursor];
  });

// The next page repeats the range and passes the returned cursor.
const nextPage: PublicProfessionalController_findAvailabilityRequest = {
  path: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
  query: { from: '2026-01-15', to: '2026-01-21', cursor: 'opaque-cursor' },
};
void nextPage;

const incompleteRange: PublicProfessionalController_findAvailabilityRequest = {
  path: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
  // @ts-expect-error A date range needs both of its bounds.
  query: { from: '2026-01-15' },
};
void incompleteRange;

createApiClient({
  baseUrl: 'http://localhost:3000',
  transport,
  // @ts-expect-error The client accepts a header provider, not token state.
  token: 'secret',
});
