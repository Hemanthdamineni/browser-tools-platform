import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'unicode-lookup',
  name: 'Unicode Code Point Explorer',
  category: 'text',
  summary: 'Inspect every character code point, plane, and UTF-8/UTF-16 encodings in a table.',
  description:
    'Paste any text and get a per-character breakdown: Unicode code point (U+XXXX), decimal value, Unicode plane, and the exact UTF-8 and UTF-16 byte sequences. Ideal for debugging mojibake, understanding astral characters such as emoji, or checking how a character is actually encoded.',
  keywords: [
    'unicode',
    'code point',
    'UTF-8',
    'UTF-16',
    'emoji codepoint',
    'byte sequence',
    'mojibake',
    'character encoding',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'table', label: 'Table' },
        { value: 'lines', label: 'Lines' },
      ],
      default: 'table',
    },
    {
      key: 'maxChars',
      label: 'Max characters',
      type: 'number',
      default: 500,
    },
  ],
  examples: [
    {
      title: 'Inspect a mixed string',
      input: 'A e',
    },
    {
      title: 'Decode an emoji as UTF-16',
      input: '👍',
      options: { format: 'lines' },
    },
    {
      title: 'Look up a control character',
      input: '\t',
      options: { maxChars: 5 },
    },
  ],
  related: ['char-frequency', 'text-stats', 'case-convert'],
  status: 'stable',
};
