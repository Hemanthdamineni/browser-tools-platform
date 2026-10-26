import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-table',
  name: 'Markdown Table Formatter',
  category: 'developer',
  summary: 'Normalize Markdown pipe tables and optionally align their columns.',
  description:
    'Format a single Markdown pipe table with consistent delimiters and optional column alignment. Escaped pipes and inline-code spans are kept inside cells; ragged rows are padded. This is a table formatter, not a full Markdown parser.',
  keywords: [
    'markdown table formatter',
    'format markdown table',
    'align markdown columns',
    'pipe table',
    'gfm table formatter',
    'markdown table generator',
    'pretty print markdown table',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'align', label: 'Align columns', type: 'boolean', default: true },
    {
      key: 'padding',
      label: 'Cell padding (spaces)',
      type: 'number',
      default: 1,
      min: 0,
      max: 4,
    },
  ],
  examples: [
    {
      title: 'Align a table',
      input: '| Name | Count |\n|---|---:|\n| apples | 3 |\n| pears | 120 |',
    },
    {
      title: 'Preserve literal pipes',
      input: '| Expression | Note |\n|---|---|\n| `a|b` | escaped \\| stays in cell |',
    },
    {
      title: 'Center alignment and no padding',
      input: '| a | b |\n|:-:| -: |\n| x | y |',
      options: { align: true, padding: 0 },
    },
  ],
  related: ['markdown-to-html', 'csv-to-json', 'json-to-csv'],
  status: 'stable',
};
