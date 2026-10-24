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
  article: [
    {
      heading: 'How the duplicate scan counts repeats',
      body: 'Paste a block of lines and the scanner splits it on newlines, then tallies how often each line occurs. A line appearing three times is reported with an occurrence count of 3 and the number of the line where it first appears; the extra count shows 2, because only the second and third copies are surplus. Results come back as a table with Line, Occurrences and First at line columns. Very long lines are truncated with an ellipsis in that table but are still compared in full.',
    },
    {
      heading: 'When a frequency table beats a duplicate list',
      body: 'For triaging a log or pruning a mailing list you often want the whole picture rather than just the repeats. Switch on “Include unique lines” to see every line with its count, singletons included, and sort by frequency to float the noisiest entries to the top.',
    },
    {
      heading: 'Case and whitespace matching',
      body: 'Lines are compared byte-for-byte by default, so Apple and apple are different entries. “Ignore case” lowercases both sides before comparing and “Ignore leading/trailing spaces” trims the ends; either way the first-seen original text is what the table shows you.',
    },
    {
      heading: 'Input limits and privacy',
      body: 'Blank input raises an error instead of returning an empty table, and anything over 1,000,000 characters is refused. Nothing is uploaded: the counting loop runs in this browser tab, so the addresses, log lines or ID lists you paste never leave your device.',
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
