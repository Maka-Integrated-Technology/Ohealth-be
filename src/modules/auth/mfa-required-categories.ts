import { ConfigService } from '@nestjs/config';

export type MfaRequiredCategory =
  'platform_admin' | 'organization_owner' | 'organization_admin';

export function mfaRequiredCategories(
  config: ConfigService,
): Set<MfaRequiredCategory> {
  const configured =
    config.get<string>('MFA_REQUIRED_CATEGORIES') ??
    'platform_admin,organization_owner,organization_admin';
  const categories = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const supported = [
    'platform_admin',
    'organization_owner',
    'organization_admin',
  ];
  if (categories.some((category) => !supported.includes(category))) {
    throw new Error('Invalid MFA_REQUIRED_CATEGORIES configuration.');
  }
  return new Set(categories as MfaRequiredCategory[]);
}
