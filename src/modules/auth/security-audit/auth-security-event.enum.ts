/**
 * Stable, allowlisted authentication event vocabulary.
 * Extend alongside the producer tests when an implementation issue lands.
 */
export enum AuthSecurityEventType {
  SIGN_IN = 'sign_in',
  CONTACT_VERIFICATION = 'contact_verification',
  PASSWORD_RECOVERY = 'password_recovery',
  PASSWORD_CHANGE = 'password_change',
  SESSION_REFRESH = 'session_refresh',
  SESSION_REUSE = 'session_reuse',
  LOGOUT = 'logout',
  ACCOUNT_STATE_CHANGE = 'account_state_change',
  OAUTH_LINK = 'oauth_link',
  REGISTRATION = 'registration',
  MFA = 'mfa',
}

export enum AuthSecurityEventOutcome {
  SUCCEEDED = 'succeeded',
  DENIED = 'denied',
  FAILED = 'failed',
}

export enum AuthSecurityRequestSource {
  WEB = 'web',
  MOBILE = 'mobile',
  API = 'api',
  UNKNOWN = 'unknown',
}
