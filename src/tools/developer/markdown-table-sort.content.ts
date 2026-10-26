/**
 * Editorial content for the markdown-table-sort tool page.
 *
 * Kept out of ``markdown-table-sort.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Rows move, everything else stays',
      body: 'Give it a single Markdown pipe table and it returns the same table with only the data rows reordered. The header row and the alignment separator stay exactly where they were, and each cell keeps its original text, so the sole change is the order of the rows beneath them.',
    },
    {
      heading: 'Tidying a table you publish as Markdown',
      body: 'It suits tables living in READMEs, changelogs and docs: ranking a benchmark table by milliseconds, ordering a dependency list by version, or putting a score leaderboard back in order after rows were appended by hand at the bottom.',
    },
    {
      heading: 'Choosing a column and a comparison',
      body: 'Name the column by its header text, matched without regard to case, or by a 1-based number when the header text is inconvenient. Order flips the direction, and sort type chooses between automatic, forced numeric and text comparison; the case-sensitive flag only affects the text mode.',
    },
    {
      heading: 'What auto-detection accepts',
      body: 'Auto compares numerically only when every cell in the column parses as a number, allowing thousands separators and k, m or percent suffixes, and falls back to text otherwise. Rows that compare equal keep their order. Pipes inside backticks and escaped pipes count as cell content, and tables beyond 5,000 rows or 200 columns are refused.',
    },
    {
      heading: 'The table stays in the page',
      body: 'Parsing and reordering run in the browser with no upload, so internal figures and identifiers never leave the tab.',
    },
  ],
  faq: [
    {
      q: 'How do I choose which column to sort by?',
      a: 'Enter the header text (matched case-insensitively) or the 1-based column number. Example: column "2" sorts by the second column even if it has no header.',
    },
    {
      q: 'What does Auto sort type do?',
      a: 'Auto compares numerically when every value in the column can be parsed as a number (including 2.7M or 1,200), and falls back to text comparison otherwise.',
    },
    {
      q: 'What stays in place?',
      a: 'The header row and the Markdown alignment separator row are never reordered. Only the data rows between/below them move, and their cell text is preserved exactly.',
    },
    {
      q: 'Is the sort stable?',
      a: 'Yes. Rows that compare equal keep their original relative order, and the comparison happens on trimmed cell values, so the output is deterministic.',
    },
  ],
} as const;
