import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-to-binary',
  name: 'Text to Binary',
  category: 'encoding',
  summary:
    'Encode text as 8-bit binary (UTF-8 aware) or decode a string of 0s and 1s back to text.',
  description:
    'Convert any text into its 8-bit binary representation, byte by byte (UTF-8 aware, so emoji and non-Latin text round-trip), or paste a string of 0s and 1s and decode it back. Bits can be grouped by byte or nibble, with or without spaces. Everything runs on your device — nothing is sent anywhere.',
  keywords: [
    'text to binary',
    'string to binary',
    'binary to text',
    'text binary converter',
    'bits to ascii',
    '8-bit binary',
    'decode binary',
    'utf8 binary encode',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      choices: [
        { value: 'encode', label: 'Text → binary' },
        { value: 'decode', label: 'Binary → text' },
      ],
      default: 'encode',
    },
    {
      key: 'groupBy',
      label: 'Group bits',
      type: 'select',
      choices: [
        { value: '8', label: '8 bits (bytes)' },
        { value: '4', label: '4 bits (nibbles)' },
      ],
      default: '8',
    },
    {
      key: 'separator',
      label: 'Separator',
      type: 'select',
      choices: [
        { value: 'space', label: 'Space between groups' },
        { value: 'none', label: 'No separator' },
      ],
      default: 'space',
    },
  ],
  examples: [
    {
      title: 'Encode a greeting',
      input: 'Hi',
    },
    {
      title: 'Decode bytes',
      input: '01001000 01101001',
      options: { mode: 'decode' },
    },
    {
      title: 'Encode with nibble grouping',
      input: 'OK',
      options: { mode: 'encode', groupBy: '4' },
    },
  ],
  related: ['hex', 'base64', 'ascii85', 'unicode-normalize'],
  status: 'stable',
};
