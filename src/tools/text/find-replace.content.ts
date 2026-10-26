/**
 * Editorial content for the find-replace tool page.
 *
 * Kept out of ``find-replace.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Three ways to match',
      body: 'Plain text finds the literal characters and replaces every occurrence. Whole word matches a word on its own with word boundaries, so "cat" in "category" is left alone while "cat" in "a cat" is replaced. Regular expression treats the Find field as a pattern and lets you build complex matches, with the flags field controlling behaviour — g for all matches, i to ignore case, m for multi-line. The stats line reports how many replacements were actually made.',
    },
    {
      heading: 'Backreferences in the replacement',
      body: 'In regex mode the replacement string is passed through untouched, so $1, $<name> and $& all work: capture groups with parentheses and reference them in the output, for example swapping first and last name with (\\w+) (\\w+) replaced by $2, $1. In plain and whole-word mode a literal $ is preserved as-is rather than interpreted, because there are no capture groups to expand.',
    },
    {
      heading: 'A realistic workflow',
      body: 'Renaming a variable across a file, normalising spacing, or de-duplicating a label by rewriting a pattern are all one paste away. For a copy you want to keep, toggle Case insensitive so that Title, title and TITLE are all caught in a single pass, or fold it off when case carries meaning and only exact matches should change.',
    },
    {
      heading: 'Errors and privacy',
      body: 'An invalid regular expression or an unknown flag raises a clear error instead of silently doing nothing, so a broken pattern is caught immediately. The replace runs in the page with no request and no upload, so a confidential document stays on your device and the whole operation works offline.',
    },
  ],
  faq: [
    {
      q: 'Are $1 backreferences supported?',
      a: 'In regex mode, yes — the replacement string is passed through untouched, so $1, $<name> and $& all work. In plain and whole-word mode a literal $ is kept as-is.',
    },
    {
      q: 'What happens with an invalid pattern?',
      a: 'An invalid regular expression or an unknown flag raises a friendly error instead of a silent no-op.',
    },
    {
      q: 'Does it replace every match?',
      a: 'Plain and whole-word mode always replace all matches. Regex mode replaces all only when the flags include "g".',
    },
  ],
} as const;
