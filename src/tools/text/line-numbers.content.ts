/**
 * Editorial content for the line-numbers tool page.
 *
 * Kept out of ``line-numbers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A running number in front of every line',
      body: 'Paste a block of text and each line comes back prefixed with a number. Start number sets the first value, Separator picks the style — "1. ", "1 | ", a tab, "1) " or "1: " — and Zero-pad to equal width pads the prefix with zeros so every number takes the width of the largest one printed.',
    },
    {
      heading: 'Quoting lines back to someone',
      body: 'It is the tool for turning a pasted log, a config file or a stack trace into something you can refer to line by line in a code review, a support ticket or a bug report, and for preparing a numbered procedure in prose.',
    },
    {
      heading: 'The two switches',
      body: 'Skip blank lines leaves empty lines exactly where they are but does not number them and does not advance the counter, so the numbering tracks content rather than rows. Zero-pad derives the width from the highest number that will actually be printed, so a run from 1 to 9 stays single-digit while a run to 120 becomes three digits wide.',
    },
    {
      heading: 'Caveats',
      body: 'Lines are split on newline only, so a file with old Mac-style CR-only endings is treated as one long line. A file ending in a newline has a final empty line, numbered or skipped per the blank-line setting. The counter never restarts inside a block.',
    },
    {
      heading: 'Numbered in the page',
      body: 'The text is transformed in your browser and nothing is uploaded, so numbering a file full of internal paths, configuration values or customer data is safe — and it works offline.',
    },
  ],
  faq: [
    {
      q: 'What happens to blank lines when "Skip blank lines" is on?',
      a: 'They stay exactly where they are but get no number, and they do not advance the counter.',
    },
    {
      q: 'How wide is the zero-padding?',
      a: 'The width of the largest number that will be printed, so every prefix lines up.',
    },
    {
      q: 'Can I number only part of a file?',
      a: 'Paste just the range you want numbered, or number everything and delete the lines you do not need. There is no "start after line N" rule: the counter simply begins at the Start number you set.',
    },
  ],
} as const;
