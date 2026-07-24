export enum AuthAccessLevel {
  FULL = 'full',
  LIMITED = 'limited',
}

export enum AuthRoutingTarget {
  EMAIL_VERIFICATION = 'email_verification',
  ADMIN_DASHBOARD = 'admin_dashboard',
  PATIENT_HOME = 'patient_home',
  PROFESSIONAL_VERIFICATION = 'professional_verification',
  PROFESSIONAL_DASHBOARD = 'professional_dashboard',
  HOSPITAL_VERIFICATION = 'hospital_verification',
  HOSPITAL_DASHBOARD = 'hospital_dashboard',
  LABORATORY_VERIFICATION = 'laboratory_verification',
  LABORATORY_DASHBOARD = 'laboratory_dashboard',
  PHARMACY_VERIFICATION = 'pharmacy_verification',
  PHARMACY_DASHBOARD = 'pharmacy_dashboard',
  ACCOUNT_SETUP = 'account_setup',
  ACCOUNT_RESTRICTED = 'account_restricted',
}
