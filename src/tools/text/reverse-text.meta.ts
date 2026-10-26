import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'reverse-text',
  name: 'Reverse Text',
  category: 'text',
  summary: 'Reverse text by character, word, sentence or line — emoji-safe.',
  description:
    'Flip a string end to end, or reverse the order of its words or lines while keeping each one readable. Splitting is done on Unicode code points so emoji and combined characters are not broken.',
  keywords: ['reverse', 'backwards', 'mirror text', 'flip', 'reverse words'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'by',
      label: 'Reverse',
      type: 'select',
      default: 'characters',
      choices: [
        { value: 'characters', label: 'Characters' },
        { value: 'words', label: 'Word order' },
        { value: 'lines', label: 'Line order' },
        { value: 'words-in-line', label: 'Words within each line' },
      ],
    },
  ],
  examples: [
    { title: 'Characters', input: 'Hello 👋 World' },
    { title: 'Word order', input: 'the quick brown fox', options: { by: 'words' } },
    { title: 'Lines in reverse', input: 'first\nsecond\nthird', options: { by: 'lines' } },
  ],
  related: ['sort-lines', 'case-convert', 'rot13'],
  status: 'stable',
};
