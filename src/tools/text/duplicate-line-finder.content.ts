/**
 * Editorial content for the duplicate-line-finder tool page.
 *
 * Kept out of ``duplicate-line-finder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the duplicate scan counts repeats',
      body: 'Paste a block of lines and the scanner splits it on newlines, then tallies how often each line occurs. A line appearing three times is reported with an occurrence count of 3 and the number of the line where it first appears; the extra count shows 2, because only the second and third copies are surplus. Results come back as a table with Line, Occurrences and First at line columns. Very long lines are truncated with an ellipsis in that table but are still compared in full.',
    },
    {
      heading: 'When a frequency table beats a duplicate list',
      body: 'For triaging a log or pruning a mailing list you often want the whole picture rather than just the repeats. Switch on “Include unique lines” to see every line with its count, singletons included, and sort by frequency to float the noisiest entries to the top.',
    },
    {
      heading: 'Case and whitespace matching',
      body: 'Lines are compared byte-for-byte by default, so Apple and apple are different entries. “Ignore case” lowercases both sides before comparing and “Ignore leading/trailing spaces” trims the ends; either way the first-seen original text is what the table shows you.',
    },
    {
      heading: 'Input limits and privacy',
      body: 'Blank input raises an error instead of returning an empty table, and anything over 1,000,000 characters is refused. Nothing is uploaded: the counting loop runs in this browser tab, so the addresses, log lines or ID lists you paste never leave your device.',
    },
  ],
  faq: [
    {
      q: 'How is a found duplicate reported?',
      a: 'Each repeated line gets a row with its count, the total occurrences, and the line number where it first appears. A line appearing three times counts as two duplicates.',
    },
    {
      q: 'What if I want unique lines too?',
      a: 'Turn on "Include unique lines" to get a full frequency table of every line, singletons included. Lines that appear once then show count 1.',
    },
    {
      q: 'Does it match byte-for-byte?',
      a: 'Yes by default. With "Ignore case" and "Ignore leading/trailing spaces" it matches on the normalized form but keeps the first-seen original text for display.',
    },
    {
      q: 'How do I remove the duplicates?',
      a: 'This tool reports them. Use the dedupe-lines tool to actually delete repeats, keeping the first or last occurrence — they work together.',
    },
  ],
} as const;
