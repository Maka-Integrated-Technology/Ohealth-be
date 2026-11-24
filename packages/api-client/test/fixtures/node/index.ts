import {
  AuthAccountResponseDtoStatus,
  createApiClient,
  OrganizationDocumentChecklistDtoMissing_document_types,
  PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType,
  PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type,
  PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status,
  type ApiClient,
  type ApiTransport,
  type AuthController_getProfileResponse,
  type AuthController_loginRequest,
  type AuthController_loginResponse,
  type LaboratoryVerificationDocumentsController_uploadMyDocumentRequest,
  type OrganizationController_listApplicationsRequest,
  type OrganizationController_listApplicationsResponse,
  type PublicProfessionalController_findAvailabilityRequest,
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

// Auth responses retain the backend's enum and nullable-field contracts.
type Account =
  AuthController_getProfileResponse['data']['account_context']['account'];
const accountStatus: Account['status'] = AuthAccountResponseDtoStatus.active;
const nullableProfileFields: Pick<
  Account['profile'],
  'country' | 'dob' | 'gender' | 'image' | 'middle_name' | 'phone'
> = {
  country: null,
  dob: null,
  gender: null,
  image: null,
  middle_name: null,
  phone: null,
};
void [accountStatus, nullableProfileFields];

// Organization review fixtures exercise enums, nullable response fields and
// page-based pagination without depending on a frontend framework.
const organizationPageRequest: OrganizationController_listApplicationsRequest =
  {
    query: {
      limit: 20,
      organization_type:
        PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type.laboratory,
      page: 2,
      verification_status:
        PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status.under_review,
    },
  };
const organizationPage: Promise<OrganizationController_listApplicationsResponse> =
  client.OrganizationController_listApplications(organizationPageRequest);
void organizationPage.then(({ data }) => {
  const total: number = data.total;
  const page: number = data.page;
  const first = data.applications[0];
  const nullableFields: readonly (string | null)[] = [
    first.contact_phone,
    first.rejection_reason,
  ];
  return [total, page, nullableFields];
});

// Multipart fields are exposed as transport-neutral strings so Node consumers
// can choose their own FormData/file implementation.
const laboratoryUpload: LaboratoryVerificationDocumentsController_uploadMyDocumentRequest =
  {
    path: {
      documentType:
        PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType.laboratory_license,
    },
    headerParameters: {
      'x-organization-id': '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    },
    body: { file: 'transport-owned-binary-field' },
  };
void client.LaboratoryVerificationDocumentsController_uploadMyDocument(
  laboratoryUpload,
);
const requiredOrganizationDocument =
  OrganizationDocumentChecklistDtoMissing_document_types.operating_license;
void requiredOrganizationDocument;

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
