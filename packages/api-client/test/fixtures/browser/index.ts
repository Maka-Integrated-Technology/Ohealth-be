import {
  createApiClient,
  PathsApiAuthBrowserLoginMfaVerifyPostParametersHeaderXOHealthClient,
  PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type,
  type ApiTransport,
  type ApiTransportRequest,
  type OrganizationController_listApplicationsRequest,
  type ProfilePhotoController_uploadRequest,
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
      PathsApiAuthBrowserLoginMfaVerifyPostParametersHeaderXOHealthClient.browser,
  },
});
void client.BrowserSessionController_completeGoogle({
  headerParameters: {
    'X-OHealth-Client':
      PathsApiAuthBrowserLoginMfaVerifyPostParametersHeaderXOHealthClient.browser,
  },
  body: {
    transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
    transaction_token: 't'.repeat(43),
    id_token: 'google-id-token',
  },
});

const profilePhotoUpload: ProfilePhotoController_uploadRequest = {
  body: { file: 'browser-form-data-field' },
};
void client.ProfilePhotoController_upload(profilePhotoUpload);

const organizationFilter: OrganizationController_listApplicationsRequest = {
  query: {
    organization_type:
      PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type.hospital,
    page: 1,
    limit: 10,
  },
};
void client.OrganizationController_listApplications(organizationFilter);
