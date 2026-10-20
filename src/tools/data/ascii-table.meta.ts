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
