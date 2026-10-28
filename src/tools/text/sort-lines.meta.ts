import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sort-lines',
  name: 'Sort Lines',
  category: 'text',
  summary: 'Sort lines alphabetically, numerically, by length, naturally, or shuffle them.',
  description:
    'Reorder the lines of a list. Choose the comparison, direction and case sensitivity, and optionally remove duplicates or blank lines in the same pass.',
  keywords: ['sort lines', 'alphabetical', 'natural sort', 'order list', 'shuffle', 'sort text'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'method',
      label: 'Sort by',
      type: 'select',
      default: 'alpha',
      choices: [
        { value: 'alpha', label: 'Alphabetical' },
        { value: 'natural', label: 'Natural (file2 before file10)' },
        { value: 'numeric', label: 'Numeric (leading number)' },
        { value: 'length', label: 'Line length' },
        { value: 'shuffle', label: 'Shuffle (random)' },
      ],
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'select',
      default: 'asc',
      choices: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
    },
    { key: 'caseSensitive', label: 'Case sensitive', type: 'boolean', default: false },
    { key: 'unique', label: 'Remove duplicate lines', type: 'boolean', default: false },
    { key: 'removeBlank', label: 'Remove blank lines', type: 'boolean', default: false },
    { key: 'trim', label: 'Trim each line first', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'Sort a list', input: 'banana\napple\ncherry' },
    { title: 'Natural sort', input: 'file10\nfile2\nfile1', options: { method: 'natural' } },
  ],
  faq: [
    {
      q: 'What is a natural sort?',
      a: 'Numbers inside the text are compared by value, not character by character, so "item2" sorts before "item10". Standard alphabetical sort would put "item10" first.',
    },
  ],
  related: [  "dedupe-lines",
  "reverse-text"],
  status: 'stable',
};
