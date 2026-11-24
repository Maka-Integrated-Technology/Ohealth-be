import {
  createApiClient,
  AuthPersonaResponseDtoType,
  type ApiTransport,
  type ApiTransportRequest,
  type AuthController_getProfileResponse,
  type ProfilePhotoController_uploadRequest,
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

void client.BookingController_findOne({
  path: {
    id: 'booking-id',
  },
});

const profilePhotoUpload: ProfilePhotoController_uploadRequest = {
  body: { file: 'native-form-data-field' },
};
void client.ProfilePhotoController_upload(profilePhotoUpload);

type AuthContext = AuthController_getProfileResponse['data']['account_context'];
const patientPersona: AuthContext['personas'][number]['type'] =
  AuthPersonaResponseDtoType.patient;
const optionalProfessional: AuthContext['professional'] = null;
const optionalActiveOrganization: AuthContext['active_organization_id'] = null;
void [patientPersona, optionalProfessional, optionalActiveOrganization];
