import { PUBLIC_DISCOVERY_TEXT } from './public-discovery.constants';

/**
 * Stored text is supplied by professionals and administrators and is not
 * validated when it is written. It reaches a public response only through the
 * two functions below, as plain text that cannot open markup even in a
 * consumer that wrongly renders it as HTML.
 */

// Control characters other than tab and line feed, and the bidirectional
// override and isolate characters that reorder how surrounding text reads.
const UNSAFE_CHARACTERS = /[^\P{Cc}\n\t]|[\u202A-\u202E\u2066-\u2069]/gu;

// What an HTML parser reads as the start of a tag, comment, or declaration.
const MARKUP_START = /<[A-Za-z/!?]/;
const MARKUP_START_RUN = /<+(?=[A-Za-z/!?])/g;

function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * A required single-line value such as a name. Unsafe characters are removed,
 * whitespace is collapsed, any `<` that would open markup is dropped, and the
 * result is cut to the label length. A value that is not text is published as
 * an empty string.
 */
export function toPublicLabel(value: unknown): string {
  if (typeof value !== 'string') return '';

  const label = value
    .replace(UNSAFE_CHARACTERS, '')
    .replace(/\s+/g, ' ')
    .replace(MARKUP_START_RUN, '')
    .trim();

  return Array.from(label)
    .slice(0, PUBLIC_DISCOVERY_TEXT.labelMaxLength)
    .join('')
    .trimEnd();
}

/**
 * An optional multi-line value such as a biography. It is published exactly
 * as written, apart from unsafe characters and line-ending differences, or
 * not at all: text that is empty, longer than the prose length, or contains
 * the start of markup is withheld rather than rewritten.
 */
export function toPublicProse(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const prose = value
    .replace(/\r\n?/g, '\n')
    .replace(UNSAFE_CHARACTERS, '')
    .trim();

  if (prose.length === 0) return null;
  if (countCharacters(prose) > PUBLIC_DISCOVERY_TEXT.proseMaxLength)
    return null;
  return MARKUP_START.test(prose) ? null : prose;
}
