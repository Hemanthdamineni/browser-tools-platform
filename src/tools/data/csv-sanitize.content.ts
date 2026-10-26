/**
 * Editorial content for the csv-sanitize tool page.
 *
 * Kept out of ``csv-sanitize.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the formula injection guard does',
      body: 'The tool reads a CSV document cell by cell and looks for the characters a spreadsheet treats as the start of a formula: equals, plus, minus and at. Any cell whose first meaningful character is one of those is flagged. In the default sanitize action a straight apostrophe is prepended inside the field, which makes the spreadsheet render the text literally instead of evaluating it, and the file is returned as sanitized.csv with CRLF line endings ready to download.',
    },
    {
      heading: 'Why the leading characters matter',
      body: 'Spreadsheets do not distinguish data from code. When a CSV is opened, a cell starting with = is treated as a formula, and functions such as HYPERLINK, IMPORTXML or web-request helpers can silently read local data or fetch a URL when the recipient merely opens the file. A plus, minus or at sign can trigger the same evaluation path in some applications. Prefixing the apostrophe keeps the original text visible while denying the spreadsheet the chance to run it.',
    },
    {
      heading: 'Auditing without changing anything',
      body: 'Report mode leaves the data untouched and returns a table of the risky cells with their row number, column number and original value, plus a count of how many were found. That is the safe way to check a third-party export — a scraped dataset, a user-submitted form dump, a partner feed — before deciding whether to clean it, because you keep the evidence rather than altering the copy. When nothing is flagged the note says so explicitly.',
    },
    {
      heading: 'Parsing rules and privacy',
      body: 'Cells are parsed with real CSV rules rather than a naive split, so quoted delimiters, doubled quotes, embedded newlines and CRLF or LF records all survive intact; unterminated quotes and stray characters after a closing quote are rejected instead of guessed. The trim option decides whether leading whitespace and control characters are skipped before detection, matching how some importers behave. Parsing, flagging and re-encoding all happen in your browser, so the file you paste never leaves it.',
    },
  ],
  faq: [
    {
      q: 'What counts as a risky formula?',
      a: 'Cells whose first meaningful character is =, +, - or @ are flagged. Depending on the spreadsheet and import path, leading whitespace or control characters may be ignored, so that detection can be enabled or disabled.',
    },
    {
      q: 'Does adding an apostrophe guarantee safety in every spreadsheet?',
      a: 'No universal mitigation works identically across every spreadsheet and import workflow. The apostrophe is a common mitigation for CSV opened in spreadsheet applications, but review the target application and keep the original data when handling sensitive workflows.',
    },
    {
      q: 'Are quoted commas and multiline fields supported?',
      a: 'Yes. The parser handles quoted delimiters, doubled quotes, CRLF/LF records and newlines inside quoted fields. Malformed quoting is rejected rather than guessed.',
    },
  ],
} as const;
