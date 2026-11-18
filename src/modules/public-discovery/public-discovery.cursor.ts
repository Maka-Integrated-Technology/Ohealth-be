/**
 * Position in the public availability order, which is the instant a slot
 * starts and then its identifier. The cursor is opaque to consumers: they
 * pass back the value a response returned and never build one.
 */
export interface IPublicAvailabilityCursor {
  startsAt: Date;
  id: string;
}

const CURSOR_VERSION = 'v1';
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const PUBLIC_AVAILABILITY_CURSOR_MAX_LENGTH = 128;

export function encodePublicAvailabilityCursor(
  position: IPublicAvailabilityCursor,
): string {
  return Buffer.from(
    `${CURSOR_VERSION}.${position.startsAt.getTime()}.${position.id}`,
    'utf8',
  ).toString('base64url');
}

/** The position a cursor names, or null when it is not one this API issued. */
export function decodePublicAvailabilityCursor(
  value: unknown,
): IPublicAvailabilityCursor | null {
  if (typeof value !== 'string' || !CURSOR_PATTERN.test(value)) return null;

  const [version, milliseconds, id, ...rest] = Buffer.from(value, 'base64url')
    .toString('utf8')
    .split('.');
  if (version !== CURSOR_VERSION || rest.length > 0) return null;
  if (!/^\d{1,15}$/.test(milliseconds ?? '')) return null;
  if (!UUID_PATTERN.test(id ?? '')) return null;

  // At most fifteen digits is always inside the range a Date can hold.
  const startsAt = new Date(Number(milliseconds));
  // Only the canonical encoding of a position is accepted.
  const position = { startsAt, id };
  return encodePublicAvailabilityCursor(position) === value ? position : null;
}
