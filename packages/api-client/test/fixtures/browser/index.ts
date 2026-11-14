import {
  createApiClient,
  PathsApiAuthBrowserLoginVerifyPostParametersHeaderXOHealthClient,
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
void client.BrowserSessionController_refresh({
  headerParameters: {
    'X-OHealth-Client':
      PathsApiAuthBrowserLoginVerifyPostParametersHeaderXOHealthClient.browser,
  },
});
void client.BrowserSessionController_completeGoogle({
  headerParameters: {
    'X-OHealth-Client':
      PathsApiAuthBrowserLoginVerifyPostParametersHeaderXOHealthClient.browser,
  },
  body: {
    transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
    transaction_token: 't'.repeat(43),
    id_token: 'google-id-token',
  },
});
