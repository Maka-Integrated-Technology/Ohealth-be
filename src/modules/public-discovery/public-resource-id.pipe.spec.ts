import { PublicDiscoveryErrorCode } from './public-discovery.constants';
import { PublicResourceNotFoundException } from './public-discovery.errors';
import { PublicResourceIdPipe } from './public-resource-id.pipe';

describe('PublicResourceIdPipe', () => {
  const pipe = new PublicResourceIdPipe();

  it('accepts a UUID and returns its canonical lower-case form', () => {
    expect(pipe.transform('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(
      '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    );
  });

  it.each([
    'not-a-uuid',
    '',
    '1',
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301' OR '1'='1",
    ['3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
    undefined,
    null,
  ])('reports the malformed identifier %p as not found', (value) => {
    expect(() => pipe.transform(value)).toThrow(
      PublicResourceNotFoundException,
    );
  });

  it('uses the stable non-enumerating error body', () => {
    const exception = new PublicResourceNotFoundException();

    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toEqual({
      message: 'Resource not found',
      error: 'Not Found',
      error_code: PublicDiscoveryErrorCode.RESOURCE_NOT_FOUND,
    });
  });
});
