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
  LOGIN_CHALLENGE_REQUEST = 'login_challenge_request',
  LOGIN_CHALLENGE_RESEND = 'login_challenge_resend',
  LOGIN_CHALLENGE_DELIVERY = 'login_challenge_delivery',
  LOGIN_CHALLENGE_EXPIRY = 'login_challenge_expiry',
  LOGIN_CHALLENGE_VERIFICATION = 'login_challenge_verification',
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
