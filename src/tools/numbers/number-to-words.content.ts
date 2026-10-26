/**
 * Editorial content for the number-to-words tool page.
 *
 * Kept out of ``number-to-words.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the converter does',
      body: 'Turn a plain number string into English words, choosing between cardinal and ordinal style. Whole numbers up to 10^21 are supported along with negatives and decimals of up to four places; a larger magnitude throws a "Number is too large to express in words" error.',
    },
    {
      heading: 'When to spell out a number',
      body: 'Write a cheque or invoice amount in words, check the wording of a formal letter, or generate an ordinal such as twenty-first for a title. The output is a plain string that drops straight into a document.',
    },
    {
      heading: 'Options that affect wording',
      body: 'The style switch selects cardinal or ordinal forms. Letter case applies lower, sentence, title or upper casing, leaving "and" lowercase in title case. The use-and switch adds the British "and" before the final tens or units within each group.',
    },
    {
      heading: 'Limits and formatting rules',
      body: 'Input must match a plain integer or decimal pattern or it is rejected. Tens and units within a group are hyphenated, negatives are prefixed with "negative", and a decimal part longer than four places raises an error.',
    },
    {
      heading: 'Conversion runs locally',
      body: 'The number is processed with BigInt and string manipulation inside this tab, so no input is transmitted and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'How large a number is supported?',
      a: 'Integers up to 10^21 are supported, along with negative values and decimals of up to four places.',
    },
    {
      q: 'How are decimals read?',
      a: 'Digits after the decimal point are spoken individually, so 3.14 becomes "three point one four".',
    },
    {
      q: 'Can decimals be written as ordinals?',
      a: 'No. Ordinal conversion applies only to whole-number wording, so a decimal input is rejected when the ordinal style is selected.',
    },
  ],
} as const;
