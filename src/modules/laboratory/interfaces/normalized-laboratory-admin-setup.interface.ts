export interface INormalizedLaboratoryPayload {
  name: string;
  registrationNumber: string;
  licenseNumber: string;
  address: string;
  region: string;
  contactEmail: string;
  contactPhone: string;
}

export interface INormalizedLaboratoryAdministratorPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}
