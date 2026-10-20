import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-markdown',
  name: 'CSV to Markdown Table',
  category: 'data',
  summary:
    'Convert a CSV table into a clean GitHub-Flavored Markdown pipe table with optional alignment.',
  description:
    'Paste a CSV file and get a tidy GFM pipe table you can drop into any Markdown document, issue, or README. Handles quoted fields with embedded commas, new lines and double quotes, escapes literal pipes and newlines inside cells, and can right-align numeric columns automatically. Fully on-device.',
  keywords: [
    'csv to markdown table',
    'csv to md',
    'markdown table generator',
    'gfm table',
    'pipe table',
    'csv renderer',
    'table converter',
    'csv to table',
    'readme table',
    'markdown from csv',
    'csv formatter',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'header', label: 'First row is a header', type: 'boolean', default: true },
    {
      key: 'justify',
      label: 'Column alignment',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto (numbers right-aligned)' },
        { value: 'left', label: 'Left-aligned' },
        { value: 'center', label: 'Center-aligned' },
        { value: 'right', label: 'Right-aligned' },
        { value: 'none', label: 'Plain (no alignment row)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Simple CSV with header',
      input: 'Name,Score\nAda,3\nTuring,120',
      options: {},
    },
    {
      title: 'Quoted field containing a comma',
      input: 'Name,Note\n"Smith, John","said ""hi"""',
      options: { justify: 'left' },
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
  related: ['markdown-table', 'csv-to-json', 'csv-to-sql', 'json-to-csv', 'csv-sanitize'],
  status: 'stable',
};
