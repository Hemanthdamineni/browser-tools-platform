import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'duplicate-line-finder',
  name: 'Duplicate Line Finder',
  category: 'text',
  summary:
    'Find repeated lines in a list, with occurrence counts and first line numbers.',
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
  ],
  faq: [
    {
      q: 'How is a found duplicate reported?',
      a: 'Each repeated line gets a row with its count, the total occurrences, and the line number where it first appears. A line appearing three times counts as two duplicates.',
    },
    {
      q: 'What if I want unique lines too?',
      a: 'Turn on "Include unique lines" to get a full frequency table of every line, singletons included. Lines that appear once then show count 1.',
    },
    {
      q: 'Does it match byte-for-byte?',
      a: 'Yes by default. With "Ignore case" and "Ignore leading/trailing spaces" it matches on the normalized form but keeps the first-seen original text for display.',
    },
    {
      q: 'How do I remove the duplicates?',
      a: 'This tool reports them. Use the dedupe-lines tool to actually delete repeats, keeping the first or last occurrence — they work together.',
    },
  ],
  related: ['dedupe-lines', 'sort-lines', 'remove-empty-lines', 'line-numbers'],
  status: 'stable',
};
