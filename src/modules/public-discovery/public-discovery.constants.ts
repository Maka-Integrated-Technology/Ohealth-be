/**
 * Shared public-discovery contract values. Every public speciality and
 * professional endpoint reads its route namespace, limits, and allowlists from
 * here so no endpoint decides them independently.
 */
export const PUBLIC_DISCOVERY_ROUTE_NAMESPACE = 'public';
export const PUBLIC_DISCOVERY_API_TAG = 'Public Discovery';

export const PUBLIC_DISCOVERY_PAGINATION = {
  defaultPage: 1,
  maxPage: 1000,
  defaultLimit: 20,
  maxLimit: 50,
} as const;

export const PUBLIC_DISCOVERY_SEARCH = {
  minLength: 2,
  maxLength: 100,
} as const;

/**
 * A speciality icon is published as an asset identifier that consumers map to
 * an icon they bundle themselves. It is never an address or a storage key.
 */
export const PUBLIC_DISCOVERY_ICON = {
  maxLength: 64,
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
} as const;

/**
 * Bounds of stored text published as plain text, in characters. A label is a
 * required single-line value such as a name; prose is an optional multi-line
 * value such as a biography.
 */
export const PUBLIC_DISCOVERY_TEXT = {
  labelMaxLength: 200,
  proseMaxLength: 4000,
} as const;

/**
 * Bounds of a consultation-fee filter. The maximum is the largest amount the
 * `professionals.consultation_fee` column can store.
 */
export const PUBLIC_DISCOVERY_FEE = {
  minimum: 0,
  maximum: 99_999_999.99,
  maxDecimalPlaces: 2,
} as const;

/** Inclusive number of calendar days one availability query may cover. */
export const PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS = 31;

export enum PublicProfessionalSortField {
  RATING = 'rating',
  EXPERIENCE = 'experience',
  CONSULTATION_FEE = 'consultation_fee',
  NAME = 'name',
}

export enum PublicSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export const PUBLIC_DISCOVERY_DEFAULT_SORT = {
  field: PublicProfessionalSortField.RATING,
  order: PublicSortOrder.DESC,
} as const;

export enum PublicDiscoveryErrorCode {
  RESOURCE_NOT_FOUND = 'PUBLIC_RESOURCE_NOT_FOUND',
}

export const PUBLIC_RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
