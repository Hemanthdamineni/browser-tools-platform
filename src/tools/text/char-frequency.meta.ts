import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'char-frequency',
  name: 'Character Frequency',
  category: 'text',
  summary:
    'Count how often each character occurs, with scope filters, optional case folding and count or character sorting.',
  description:
    'Build a frequency table of every character in your text. Restrict the scope to letters, alphanumerics or non-whitespace, fold uppercase and lowercase together, and sort by count or by character.',
  keywords: [
    'character frequency',
    'letter frequency',
    'char count',
    'frequency analysis',
    'letter count',
    'cryptanalysis',
    'character distribution',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'scope',
      label: 'Count which characters',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'All characters' },
        { value: 'letters', label: 'Letters only' },
        { value: 'alphanumeric', label: 'Letters and digits' },
        { value: 'no-whitespace', label: 'Exclude whitespace' },
      ],
    },
    {
      key: 'caseInsensitive',
      label: 'Ignore case',
      type: 'boolean',
      default: false,
    },
    {
      key: 'sortBy',
      label: 'Sort by',
      type: 'select',
      default: 'count',
      choices: [
        { value: 'count', label: 'Count (descending)' },
        { value: 'char', label: 'Character (ascending)' },
      ],
    },
  ],
  examples: [
    { title: 'Letters only', input: 'Hello, World!', options: { scope: 'letters' } },
    { title: 'Case-insensitive', input: 'aAbBbB', options: { caseInsensitive: true } },
    { title: 'Sort by character', input: 'banana', options: { sortBy: 'char' } },
  ],
  faq: [
    {
      q: 'How are spaces and control characters shown?',
      a: 'A space is shown as (space), a tab as \\t, a newline as \\n, and any other control character as \\xNN with its two-digit hexadecimal code.',
    },
    {
      q: 'What is the percentage relative to?',
      a: 'The number of characters that remain after the scope filter is applied.',
    },
    {
      q: 'Does it count by code point?',
      a: 'Yes. Text is split into Unicode code points, so most emoji and combining sequences are handled sensibly.',
    },
  ],
  related: [  "word-frequency",
  "text-stats",
  "hex",
  "unicode-escape"],
  status: 'stable',
};
