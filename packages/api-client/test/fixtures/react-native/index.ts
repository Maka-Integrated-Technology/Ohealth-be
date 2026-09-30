import {
  createApiClient,
  type ApiTransport,
  type ApiTransportRequest,
} from '@ohealth/api-client';

declare const nativeRequest: (request: ApiTransportRequest) => Promise<unknown>;

const transport: ApiTransport = async (request: ApiTransportRequest) => ({
  status: 200,
  data: await nativeRequest(request),
});

const client = createApiClient({
  baseUrl: 'https://api.ohealth.example',
  transport,
  getHeaders: async () => ({
    Authorization: 'Bearer value-from-secure-storage',
  }),
});

void client.AuthController_activateAccount({
  path: {
    user_id: 'user-id',
  },
});
