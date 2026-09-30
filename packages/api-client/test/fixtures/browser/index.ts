import {
  createApiClient,
  type ApiTransport,
  type ApiTransportRequest,
} from '@ohealth/api-client';

const transport: ApiTransport = async (request: ApiTransportRequest) => {
  window.dispatchEvent(
    new CustomEvent('ohealth-request', {
      detail: request.operationId,
    }),
  );

  return {
    status: 200,
    data: {},
  };
};

const client = createApiClient({
  baseUrl: window.location.origin,
  transport,
});

void client.AuthController_getProfile();
