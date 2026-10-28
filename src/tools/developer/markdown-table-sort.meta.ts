import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-table-sort',
  name: 'Markdown Table Sorter',
  category: 'developer',
  summary: 'Sort Markdown pipe-table rows by a column: numeric or text, ascending or descending.',
  description:
    'Reorder the data rows of a single Markdown pipe table by the value in one column. Pick the column by its header text or by 1-based index, choose numeric or text comparison (auto-detected), and sort ascending or descending. The header and alignment row stay fixed; cells keep their original text. Runs entirely in the browser, so your tables never leave the tab.',
  keywords: [
    'markdown table sort',
    'sort markdown table',
    'sort table by column',
    'markdown table reorder',
    'order markdown rows',
    'pipe table sorting',
    'sort rows by header',
    'numeric sort markdown',
    'markdown table organize',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'column',
      label: 'Column (header or number)',
      type: 'text',
      default: '1',
      placeholder: 'Name or 2',
    },
    {
      key: 'order',
      label: 'Order',
      type: 'select',
      choices: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
      default: 'asc',
    },
    {
      key: 'sortType',
      label: 'Sort type',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Auto' },
        { value: 'numeric', label: 'Numeric' },
        { value: 'text', label: 'Text' },
      ],
      default: 'auto',
    },
    {
      key: 'caseSensitive',
      label: 'Case-sensitive text sort',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Sort by a numeric column',
      input: '| Name | Count |\n|---|---:|\n| pears | 120 |\n| apples | 3 |\n| figs | 48 |',
      options: { column: 'Count', order: 'desc' },
    },
    {
      title: 'Sort by header with auto-detection',
      input:
        '| City | Population |\n|------|-----------:|\n| Osaka | 2.7M |\n| Berlin | 3.7M |\n| Lisbon | 0.5M |',
      options: { column: 'Population', order: 'asc' },
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
  related: [  "markdown-table",
  "markdown-toc",
  "csv-to-markdown",
  "sort-lines"],
  status: 'stable',
};
