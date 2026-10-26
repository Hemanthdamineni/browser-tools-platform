import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'duplicate-line-finder',
  name: 'Duplicate Line Finder',
  category: 'text',
  summary: 'Find repeated lines in a list, with occurrence counts and first line numbers.',
  description:
    'Scan a list of lines for duplicates. Each repeated line is reported with how many times it appears, the line number of the first occurrence, and its repeat count. Toggle to see the whole frequency table including singletons, sort by frequency or position, and ignore case or surrounding spaces. The perfect companion for cleaning up logs, CSVs or mailing lists — and it runs entirely on your device.',
  keywords: [
    'duplicate lines finder',
    'find repeated lines',
    'duplicate line tool',
    'line frequency count',
    'find duplicates text',
    'duplicate detection',
    'unique vs duplicate lines',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'ignoreCase',
      label: 'Ignore case',
      type: 'boolean',
      default: false,
    },
    {
      key: 'trim',
      label: 'Ignore leading/trailing spaces',
      type: 'boolean',
      default: false,
    },
    {
      key: 'includeUnique',
      label: 'Include unique lines (full frequency table)',
      type: 'boolean',
      default: false,
    },
    {
      key: 'sortBy',
      label: 'Sort by',
      type: 'select',
      choices: [
        { value: 'position', label: 'First occurrence' },
        { value: 'frequency', label: 'Frequency (most repeats first)' },
      ],
      default: 'position',
    },
  ],
  examples: [
    {
      title: 'A list with repeats',
      input: 'apple\nbanana\napple\ncherry\nbanana\napple',
    },
    {
      title: 'Full frequency table, most repeats first',
      input: 'foo\nbar\nfoo\nbaz\nfoo\nbar',
      options: { includeUnique: true, sortBy: 'frequency' },
    },
    {
      title: 'Case-insensitive scan',
      input: 'HTTP 200\nhttp 200\nHTTP 200\nHttp 404',
      options: { ignoreCase: true },
    },
  ],
  related: ['dedupe-lines', 'sort-lines', 'remove-empty-lines', 'line-numbers'],
  status: 'stable',
};
