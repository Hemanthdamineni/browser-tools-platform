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
  article: [
    {
      heading: 'What the counter reports',
      body: 'Split your text into Unicode code points and count how often each occurs, returning a table with Character, Count and % columns where the percentage is relative to the characters that survive the scope filter. Count ties fall back to character order.',
    },
    {
      heading: 'When to profile character use',
      body: 'Measure the letter distribution of a passage, spot repeated characters during a password review, or run basic frequency analysis on ciphertext. Because scope and case folding are configurable, the same table suits prose, code and data.',
    },
    {
      heading: 'Options that change the table',
      body: 'Scope limits counting to all characters, letters only, letters and digits, or everything except whitespace. Ignore case folds uppercase and lowercase together before counting, and the sort control orders the table by count descending or by character ascending.',
    },
    {
      heading: 'How special characters appear',
      body: 'A space renders as (space), a tab as backslash-t, a newline as backslash-n and a return as backslash-r, while any other control character is shown as a two-digit hexadecimal escape. Visible characters appear as themselves.',
    },
    {
      heading: 'Counting stays in this tab',
      body: 'The frequency table is built with a plain map over your own text, so nothing is uploaded and the counter keeps working offline once the app is loaded.',
    },
  ],
  related: ['word-frequency', 'text-stats', 'hex', 'unicode-normalize'],
  status: 'stable',
};
