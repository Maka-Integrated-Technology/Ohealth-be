import { SetMetadata } from '@nestjs/common';

import { AuthCapability } from '../context/auth-capability';

export const AUTH_CAPABILITIES_KEY = 'auth_capabilities';
export const RequireCapabilities = (...capabilities: AuthCapability[]) =>
  SetMetadata(AUTH_CAPABILITIES_KEY, capabilities);
