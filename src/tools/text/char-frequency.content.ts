/**
 * Editorial content for the char-frequency tool page.
 *
 * Kept out of ``char-frequency.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the counter reports',
      body: 'Split your text into Unicode code points and count how often each occurs, returning a table with Character, Count and % columns where the percentage is relative to the characters that survive the scope filter. Count ties fall back to character order.',
    },
    {
      heading: 'When to profile character use',
      body: 'Measure the letter distribution of a passage, spot repeated characters during a password review, or run basic frequency analysis on ciphertext. Because scope and case folding are configurable, the same table suits prose, code and data.',
    },
    {
      heading: 'Options that change the table',
      body: 'Scope limits counting to all characters, letters only, letters and digits, or everything except whitespace. Ignore case folds uppercase and lowercase together before counting, and the sort control orders the table by count descending or by character ascending.',
    },
    {
      heading: 'How special characters appear',
      body: 'A space renders as (space), a tab as backslash-t, a newline as backslash-n and a return as backslash-r, while any other control character is shown as a two-digit hexadecimal escape. Visible characters appear as themselves.',
    },
    {
      heading: 'Counting stays in this tab',
      body: 'The frequency table is built with a plain map over your own text, so nothing is uploaded and the counter keeps working offline once the app is loaded.',
    },
  ],
  faq: [
    {
      q: 'How are spaces and control characters shown?',
      a: 'A space is shown as (space), a tab as \\t, a newline as \\n, and any other control character as \\xNN with its two-digit hexadecimal code.',
    },
    {
      q: 'What is the percentage relative to?',
      a: 'The number of characters that remain after the scope filter is applied.',
    },
    {
      q: 'Does it count by code point?',
      a: 'Yes. Text is split into Unicode code points, so most emoji and combining sequences are handled sensibly.',
    },
  ],
} as const;
