/**
 * Editorial content for the csv-to-markdown tool page.
 *
 * Kept out of ``csv-to-markdown.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it turns CSV into',
      body: 'Paste comma-separated data and this tool builds a GitHub-Flavored Markdown pipe table: a header row, a separator row and one row per record, with a pipe around every cell. The parser follows RFC 4180, so double-quoted fields containing commas, newlines or doubled quotes are read correctly instead of being split in the wrong place. The output is plain Markdown you can paste into a README, issue, comment or wiki page.',
    },
    {
      heading: 'When it saves you time',
      body: 'Reach for it when a spreadsheet, a database export or an API response arrives as CSV and you need a table for a document that renders Markdown. Rather than retyping a table by hand and getting the pipes wrong, paste the CSV and take the aligned result. It is also useful for turning a small dataset into something readable in a pull request description.',
    },
    {
      heading: 'Header and alignment options',
      body: 'The First row is a header switch controls whether the first record becomes the table header or an ordinary body row. Column alignment writes GFM alignment markers into the separator: auto right-aligns columns whose values all look numeric and leaves text columns left-aligned, while left, center and right force a single alignment everywhere and none emits a plain separator with no colons at all.',
    },
    {
      heading: 'What it will and will not handle',
      body: 'Literal pipe characters inside a cell are escaped as \\| so they never break the table, and real newlines inside a quoted field become spaces, which is the only way a pipe table can hold them. Every row must have the same number of fields; a mismatch is reported with its row number rather than silently padded. Blank lines are skipped, and this is not a Markdown-to-CSV tool — it goes one way only.',
    },
    {
      heading: 'Your data stays in the tab',
      body: 'The CSV is parsed and rendered entirely in your browser. Nothing is posted to a server, no analytics touch the text, and the tool works offline — safe for internal data such as a customer export you would rather not paste into a web form.',
    },
  ],
  faq: [
    {
      q: 'How are special characters handled?',
      a: 'Literal pipe characters inside cells are escaped as \\| so they never break the table. Real new lines inside quoted fields become spaces. Everything else is preserved verbatim, including quotes, backticks and indentation.',
    },
    {
      q: 'What does the alignment row do?',
      a: 'The GFM header separator can express alignment: | --- | (left, default), | :---: | (center), | ---: | (right). In auto mode, columns that look numeric get right alignment and text columns stay left-aligned.',
    },
    {
      q: 'Which CSV syntax is accepted?',
      a: 'RFC 4180: comma separated with double-quote quoting, so fields containing commas, new lines or quotes parse correctly. Rows must have the same number of fields; a mismatch is reported with its row number. Blank lines are skipped.',
    },
    {
      q: 'Is this different from the markdown-table formatter?',
      a: "Yes. That tool takes an existing pipe table and normalises spacing/alignment. This one takes CSV — no Markdown yet — and produces a pipe table from scratch. Feed this tool's output into markdown-table if you want to rejoin or re-align afterwards.",
    },
  ],
} as const;
