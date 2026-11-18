import {
  decodePublicAvailabilityCursor,
  encodePublicAvailabilityCursor,
} from './public-discovery.cursor';

const POSITION = {
  startsAt: new Date('2031-03-11T08:00:00.000Z'),
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};

describe('public availability cursor', () => {
  it('round-trips a position', () => {
    const cursor = encodePublicAvailabilityCursor(POSITION);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePublicAvailabilityCursor(cursor)).toEqual(POSITION);
  });

  it('keeps millisecond precision', () => {
    const position = {
      ...POSITION,
      startsAt: new Date('2031-03-11T08:00:00.123Z'),
    };

    expect(
      decodePublicAvailabilityCursor(encodePublicAvailabilityCursor(position)),
    ).toEqual(position);
  });

  const encode = (text: string) => Buffer.from(text).toString('base64url');

  it.each([
    ['not text', 42],
    ['empty', ''],
    ['not base64url', 'abc+/='],
    ['too long', 'a'.repeat(129)],
    ['another version', encode(`v2.1931000000000.${POSITION.id}`)],
    ['a malformed identifier', encode('v1.1931000000000.not-a-uuid')],
    [
      'an upper-case identifier',
      encode(`v1.1931000000000.${POSITION.id.toUpperCase()}`),
    ],
    ['a negative instant', encode(`v1.-5.${POSITION.id}`)],
    ['a fractional instant', encode(`v1.1.5.${POSITION.id}`)],
    ['extra parts', encode(`v1.1931000000000.${POSITION.id}.x`)],
    [
      'a non-canonical encoding',
      encodePublicAvailabilityCursor(POSITION) + 'A',
    ],
  ])('rejects %s', (_label, value) => {
    expect(decodePublicAvailabilityCursor(value)).toBeNull();
  });
});
