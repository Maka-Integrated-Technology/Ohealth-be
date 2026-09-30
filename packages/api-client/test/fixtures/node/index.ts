import {
  createApiClient,
  type ApiClient,
  type ApiTransport,
  type AuthController_loginRequest,
  type AuthController_loginResponse,
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

createApiClient({
  baseUrl: 'http://localhost:3000',
  transport,
  // @ts-expect-error The client accepts a header provider, not token state.
  token: 'secret',
});
