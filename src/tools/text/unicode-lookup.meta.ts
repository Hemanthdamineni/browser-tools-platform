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
  ],
  faq: [
    {
      q: 'What is a code point?',
      a: 'Each character in Unicode has a numeric code point, usually written U+ followed by hex, e.g. U+1F44D for the thumbs-up emoji.',
    },
    {
      q: 'Which characters count as astral?',
      a: 'Code points above U+FFFF live outside the Basic Multilingual Plane and are encoded in UTF-16 as a surrogate pair of two 16-bit units.',
    },
    {
      q: 'Why does the UTF-8 column matter?',
      a: 'Mojibake happens when bytes encoded in one UTF flavour are decoded as another. The UTF-8 column shows exactly how many bytes each character requires (1-4).',
    },
  ],
  related: ['char-frequency', 'text-stats', 'case-convert'],
  status: 'stable',
};
