/**
 * Editorial content for the number-base tool page.
 *
 * Kept out of ``number-base.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Converting between any two radices',
      body: 'Enter a whole number and pick a source and target base between 2 and 36. The value is parsed digit by digit into a BigInt and written back out in the target base, so nothing is ever narrowed to a 53-bit floating-point number. Base 36 uses the digits 0-9 followed by a-z, which makes the tool useful for short identifiers as well as binary and hexadecimal work.',
    },
    {
      heading: 'Prefixes and ignored separators',
      body: 'A leading 0x, 0o or 0b prefix overrides the From base setting and selects hexadecimal, octal or binary, while a leading minus or plus sign sets the sign. Underscores, spaces, commas and apostrophes are stripped before parsing, so 1_000_000 or 1,000,000 can be pasted straight from source code or a spreadsheet without cleaning them first.',
    },
    {
      heading: 'Output formatting options',
      body: 'Add prefix rewrites the result with 0x, 0o or 0b when the target is base 16, 8 or 2 — other bases are left plain. Group digits inserts a space every four characters counted from the right, which makes long binary and hexadecimal values far easier to read at a glance.',
    },
    {
      heading: 'Rejected digits are named',
      body: 'A character that is not a valid digit for the selected source base stops the conversion with a message naming the offending character, rather than truncating the value silently. Negative zero is normalised to a plain zero, and the tool never evaluates expressions — digits only.',
    },
    {
      heading: 'No size limit, no upload',
      body: 'Because parsing uses BigInt the input length is bounded only by the text you paste; very long binary strings convert exactly. The calculation runs in this tab with no network request, so the number never leaves your browser.',
    },
  ],
  faq: [
    {
      q: 'How large a number can it handle?',
      a: 'Any size. Parsing and conversion use BigInt, so there is no 53-bit floating-point limit.',
    },
    {
      q: 'What input formats are accepted?',
      a: 'An optional leading minus sign, an optional 0x / 0o / 0b prefix, and digits 0-9 then a-z for values 10-35. Underscores, spaces, commas and apostrophes are stripped.',
    },
    {
      q: 'What happens if a digit is invalid for the chosen base?',
      a: 'The tool reports which character is out of range for the "from base" you selected.',
    },
  ],
} as const;
