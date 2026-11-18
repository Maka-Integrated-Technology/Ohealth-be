import {
  createApiClient,
  type ApiClient,
  type ApiTransport,
  type AuthController_loginRequest,
  type AuthController_loginResponse,
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
