import { PublicDiscoveryClock } from './public-discovery.clock';

describe('PublicDiscoveryClock', () => {
  it('reports the current instant', () => {
    const before = Date.now();
    const now = new PublicDiscoveryClock().now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
