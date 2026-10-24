import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ascii-table',
  name: 'ASCII Table Generator',
  category: 'data',
  summary:
    'Turn CSV (or tab-separated) rows into a bordered ASCII table for docs, emails and code comments.',
  description:
    'Convert delimiter-separated rows into a tidy ASCII grid table with +--+ borders, aligned cells and a separated header row. Auto-detect the delimiter or pick comma, tab, semicolon or a custom one. Three alignments (left, right, center) and one cell style. Great for pasting into plain text files, emails, or source-code comments.',
  keywords: [
    'ascii table generator',
    'text table maker',
    'csv to ascii table',
    'grid table generator',
    'plain text table',
    'ascii art table',
    'table in email',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Column separator',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: ',', label: 'Comma ,' },
        { value: '\t', label: 'Tab' },
        { value: ';', label: 'Semicolon ;' },
        { value: '|', label: 'Pipe |' },
      ],
      default: 'auto',
    },
    {
      key: 'align',
      label: 'Alignment',
      type: 'select',
      choices: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
      default: 'left',
    },
    {
      key: 'header',
      label: 'First row is a header',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'CSV input',
      input: 'name,role,url\nAda,Analyst,https://ada.dev\nGrace,Engineer,https://grace.dev',
    },
    {
      title: 'Tab-separated with a tab delimiter',
      input: 'name\tqty\nwidget\t3\nbolt\t12',
      options: { delimiter: '\t' },
    },
    {
      title: 'Semicolons, right-aligned numbers',
      input: 'city;population\nParis;2148000\nBerlin;3645000',
      options: { delimiter: ';', align: 'right' },
    },
  ],
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
  related: ['markdown-table', 'csv-to-markdown', 'csv-to-html', 'csv-to-sql'],
  status: 'stable',
};
