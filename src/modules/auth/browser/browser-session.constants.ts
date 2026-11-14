export const BROWSER_CLIENT_HEADER = 'x-ohealth-client';
export const BROWSER_CLIENT_HEADER_VALUE = 'browser';
export const BROWSER_REFRESH_COOKIE = '__Host-ohealth_refresh';
export const DEVELOPMENT_BROWSER_REFRESH_COOKIE = 'ohealth_refresh_dev';

export const BROWSER_REFRESH_COOKIE_ALIASES = new Set([
  BROWSER_REFRESH_COOKIE,
  DEVELOPMENT_BROWSER_REFRESH_COOKIE,
  'refresh_token',
  'refreshToken',
  'ohealth_refresh',
]);
