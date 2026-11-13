/**
 * Builds the `ILIKE` pattern for a normalized public search term. The term is
 * matched literally: pattern wildcards and the escape character supplied by a
 * caller are escaped, so a search can never widen itself.
 */
export function toPublicSearchPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
