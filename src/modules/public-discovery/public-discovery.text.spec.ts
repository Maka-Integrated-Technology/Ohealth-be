import { toPublicLabel, toPublicProse } from './public-discovery.text';

// Built from code points so this file itself holds no invisible characters.
const NUL = String.fromCharCode(0);
const BELL = String.fromCharCode(7);
const ESCAPE = String.fromCharCode(0x1b);
const DELETE = String.fromCharCode(0x7f);
const C1_CONTROL = String.fromCharCode(0x85);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCharCode(0x202e);
const LEFT_TO_RIGHT_EMBEDDING = String.fromCharCode(0x202a);
const FIRST_STRONG_ISOLATE = String.fromCharCode(0x2068);
const POP_ISOLATE = String.fromCharCode(0x2069);
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);
const EMOJI = String.fromCodePoint(0x1f600);

const MARKUP_START = /<[A-Za-z/!?]/;

const HOSTILE_VALUES = [
  '<script>alert(1)</script>',
  '<ScRiPt src=//evil.example/x.js>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<a href="javascript:alert(1)">profile</a>',
  '</textarea><script>alert(1)</script>',
  '<!--<script>-->',
  '<![CDATA[x]]>',
  '<?xml version="1.0"?>',
  '<<script>alert(1)</script>',
  '<<<b>',
  `<${NUL}script>alert(1)</script>`,
  `<${RIGHT_TO_LEFT_OVERRIDE}script>`,
  `<${ESCAPE}img src=x>`,
  'text <iframe',
  '<p',
  '<b>bold</b> and <i>italic</i>',
];

describe('toPublicLabel', () => {
  it.each([
    ['Ada Obi', 'Ada Obi'],
    ['  Ada   Obi  ', 'Ada Obi'],
    ['Ada\n\tObi\r\n', 'Ada Obi'],
    ["Ngozi O'Neil-Adeyemi", "Ngozi O'Neil-Adeyemi"],
    ['Zoë Ångström', 'Zoë Ångström'],
    ['R&D Cardiology', 'R&D Cardiology'],
    ['a < b', 'a < b'],
    ['Grade <3', 'Grade <3'],
    ['Under<5', 'Under<5'],
  ])('publishes %p as %p', (value, expected) => {
    expect(toPublicLabel(value)).toBe(expected);
  });

  it.each([
    [`Ada${NUL} Obi`, 'Ada Obi'],
    [`Ada${BELL}${ESCAPE}${DELETE}${C1_CONTROL} Obi`, 'Ada Obi'],
    [`Ada ${NUL} Obi`, 'Ada Obi'],
    [`${RIGHT_TO_LEFT_OVERRIDE}Ada${LEFT_TO_RIGHT_EMBEDDING} Obi`, 'Ada Obi'],
    [`${FIRST_STRONG_ISOLATE}Ada${POP_ISOLATE}`, 'Ada'],
  ])('removes control and direction characters from %j', (value, expected) => {
    expect(toPublicLabel(value)).toBe(expected);
  });

  it('keeps joiners that scripts and emoji sequences depend on', () => {
    const value = `A${ZERO_WIDTH_JOINER}B`;

    expect(toPublicLabel(value)).toBe(value);
  });

  it.each([
    ['<script>alert(1)</script>', 'script>alert(1)/script>'],
    ['<b>Ada</b> Obi', 'b>Ada/b> Obi'],
    ['<<script>', 'script>'],
    ['<<<b>', 'b>'],
    ['<!--x-->', '!--x-->'],
    ['<?xml?>', '?xml?>'],
    ['Ada <img src=x onerror=alert(1)>', 'Ada img src=x onerror=alert(1)>'],
    [`A<${NUL}b>`, 'Ab>'],
  ])('drops the markup opener from %j', (value, expected) => {
    expect(toPublicLabel(value)).toBe(expected);
  });

  it.each(HOSTILE_VALUES)('leaves no markup start in %j', (value) => {
    expect(toPublicLabel(value)).not.toMatch(MARKUP_START);
  });

  it.each([[null], [undefined], [5], [true], [{}], [['Ada']]])(
    'publishes the non-text value %p as an empty label',
    (value) => {
      expect(toPublicLabel(value)).toBe('');
    },
  );

  it('cuts a label to 200 characters', () => {
    expect(toPublicLabel('a'.repeat(250))).toHaveLength(200);
    expect(toPublicLabel('a'.repeat(200))).toHaveLength(200);
  });

  it('counts characters, not code units, when cutting', () => {
    const label = toPublicLabel(EMOJI.repeat(250));

    expect(Array.from(label)).toHaveLength(200);
    expect(label.endsWith(EMOJI)).toBe(true);
  });

  it('leaves no trailing space after cutting', () => {
    expect(toPublicLabel(`${'a'.repeat(199)} b`)).toBe('a'.repeat(199));
  });
});

describe('toPublicProse', () => {
  it.each([
    ['Consultant cardiologist.'],
    ['Line one\nLine two\n\nLine four'],
    ['Column\tvalue'],
    ['BMI > 30 and children < 5 years'],
    ['I <3 preventive care'],
    ['R&D lead at St. Mary’s'],
    ['Shown as text: &lt;b&gt;not bold&lt;/b&gt;'],
    ['2 < 3 > 1'],
    ['Ask about javascript: and data: links'],
    [`Namaste ${EMOJI}`],
  ])('publishes %j exactly as written', (value) => {
    expect(toPublicProse(value)).toBe(value);
  });

  it('normalizes line endings and surrounding space', () => {
    expect(toPublicProse('  One\r\nTwo\rThree\n  ')).toBe('One\nTwo\nThree');
  });

  it('removes control and direction characters', () => {
    expect(
      toPublicProse(
        `One${NUL}${BELL}${ESCAPE}${DELETE}${C1_CONTROL}${RIGHT_TO_LEFT_OVERRIDE}${POP_ISOLATE} two`,
      ),
    ).toBe('One two');
  });

  it.each(HOSTILE_VALUES)('withholds %j instead of rewriting it', (value) => {
    expect(toPublicProse(value)).toBeNull();
    expect(toPublicProse(`A biography. ${value} More text.`)).toBeNull();
  });

  it.each([
    [''],
    ['   '],
    ['\r\n\t'],
    [`${NUL}${RIGHT_TO_LEFT_OVERRIDE}`],
    [null],
    [undefined],
    [5],
    [{}],
    [['text']],
  ])('withholds the empty or non-text value %j', (value) => {
    expect(toPublicProse(value)).toBeNull();
  });

  it('publishes text at the 4000 character bound and withholds longer text', () => {
    expect(toPublicProse('a'.repeat(4000))).toHaveLength(4000);
    expect(toPublicProse('a'.repeat(4001))).toBeNull();
  });

  it('counts characters, not code units, against the bound', () => {
    expect(toPublicProse(EMOJI.repeat(4000))).toBe(EMOJI.repeat(4000));
    expect(toPublicProse(EMOJI.repeat(4001))).toBeNull();
  });

  it('measures the bound after trimming', () => {
    expect(toPublicProse(`  ${'a'.repeat(4000)}  `)).toHaveLength(4000);
  });
});
