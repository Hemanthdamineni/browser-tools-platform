import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dedupe-lines',
  name: 'Remove Duplicate Lines',
  category: 'text',
  summary: 'Delete repeated lines from a list, keeping the first or last occurrence.',
  description:
    'Strip duplicates from a list of lines. Optionally ignore case and surrounding whitespace when comparing, keep only lines that appeared more than once, or invert to keep only the unique ones.',
  keywords: ['deduplicate', 'remove duplicates', 'unique lines', 'distinct', 'uniq'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'keep',
      label: 'Keep',
      type: 'select',
      default: 'first',
      choices: [
        { value: 'first', label: 'First occurrence' },
        { value: 'last', label: 'Last occurrence' },
        { value: 'only-duplicates', label: 'Only lines that repeat' },
        { value: 'only-unique', label: 'Only lines that appear once' },
      ],
    },
    { key: 'ignoreCase', label: 'Ignore case', type: 'boolean', default: false },
    { key: 'trim', label: 'Ignore leading/trailing spaces', type: 'boolean', default: false },
    { key: 'keepBlank', label: 'Never remove blank lines', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'De-dupe', input: 'a\nb\na\nc\nb' },
    { title: 'Only repeats', input: 'a\nb\na\nc\nb', options: { keep: 'only-duplicates' } },
    {
      title: 'Case-insensitive de-dupe, keeping the last',
      input: 'Apple\napple\nBanana',
      options: { keep: 'last', ignoreCase: true },
    },
  ],
  related: ['sort-lines', 'whitespace-visualizer', 'word-frequency'],
  status: 'stable',
};
