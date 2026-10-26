/**
 * Editorial content for the ascii-table tool page.
 *
 * Kept out of ``ascii-table.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From delimited rows to a grid',
      body: 'Paste comma, tab, semicolon or pipe separated rows and the tool pads every row to the widest column count, measures each column, and prints a classic +---+ grid with | cell | separators. With the header option on, the first row is followed by the same border so it reads as a heading; the output is plain text with no markup at all.',
    },
    {
      heading: 'Choosing a column separator',
      body: 'Auto-detect counts unquoted occurrences of each candidate in the first 4,000 characters and picks the most common, which handles most CSV exports and TSV dumps. Switch to an explicit separator when a field itself contains the character auto-detection would choose, such as a pipe inside prose.',
    },
    {
      heading: 'When an ASCII table is the right shape',
      body: 'This suits destinations that accept literal text but no markup: a code comment, a changelog, a plain-text email, a ticket description, or a fixed-width log readout. If the destination renders markdown, the markdown table tool gives reflowable, clickable output instead.',
    },
    {
      heading: 'Alignment, quoting and size limits',
      body: 'Left, right and center control cell padding, and right is the natural pick for numbers so digits line up. Quoted fields keep embedded delimiters and newlines, but a row with more cells than the widest row is truncated to that column count, and input longer than 500,000 characters is rejected.',
    },
    {
      heading: 'Rows never leave the tab',
      body: 'Parsing and rendering run entirely in the browser on the pasted string, so no rows are sent anywhere and nothing is saved between visits.',
    },
  ],
  faq: [
    {
      q: 'What delimiters are supported?',
      a: 'Comma, tab, semicolon and pipe — or let auto-detection pick. Fields enclosed in quotes are parsed correctly, including embedded delimiters and newlines.',
    },
    {
      q: 'What styles can I choose?',
      a: 'Cell alignment (left/right/center) and whether the first row becomes a header with a divider line. The border style is fixed to the classic +---+ grid.',
    },
    {
      q: 'Can I paste the result into markdown or email?',
      a: 'Yes — an ASCII table renders as literal text in markdown with escaping, in code blocks, and in plain-text emails. It is not markdown; use markdown-table for that.',
    },
  ],
} as const;
