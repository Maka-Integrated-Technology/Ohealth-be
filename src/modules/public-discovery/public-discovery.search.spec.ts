import { toPublicSearchPattern } from './public-discovery.search';

describe('toPublicSearchPattern', () => {
  it('wraps the term for a contains match', () => {
    expect(toPublicSearchPattern('heart care')).toBe('%heart care%');
  });

  it.each([
    ['100%', '%100\\%%'],
    ['general_doctor', '%general\\_doctor%'],
    ['back\\slash', '%back\\\\slash%'],
    ['%%', '%\\%\\%%'],
    ['__', '%\\_\\_%'],
  ])('matches the wildcard characters in %p literally', (term, pattern) => {
    expect(toPublicSearchPattern(term)).toBe(pattern);
  });

  it('leaves quotes to the bound parameter', () => {
    expect(toPublicSearchPattern("o'neil")).toBe("%o'neil%");
  });
});
