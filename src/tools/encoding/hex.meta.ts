import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'hex',
  name: 'Hex Encode / Decode',
  category: 'encoding',
  summary: 'Convert text to and from hexadecimal (UTF-8), with configurable separators.',
  description:
    'Encode text as hex bytes or decode a hex string back to text. Choose the byte separator (none, space, colon, 0x, \\x) and case. UTF-8 throughout.',
  keywords: ['hex', 'hexadecimal', 'base16', 'encode', 'decode', 'bytes', 'ascii to hex'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Hex' },
        { value: 'decode', label: 'Hex → Text' },
      ],
    },
    {
      key: 'separator',
      label: 'Byte separator (encoding)',
      type: 'select',
      default: 'space',
      choices: [
        { value: 'none', label: 'None (deadbeef)' },
        { value: 'space', label: 'Space (de ad be ef)' },
        { value: 'colon', label: 'Colon (de:ad:be:ef)' },
        { value: '0x', label: '0x prefix (0xde 0xad)' },
        { value: 'backslash-x', label: '\\x prefix (\\xde\\xad)' },
      ],
      showWhen: { key: 'mode', value: 'encode' },
    },
    {
      key: 'uppercase',
      label: 'Uppercase',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'encode' },
    },
  ],
  examples: [
    { title: 'Encode "Hi"', input: 'Hi', options: { mode: 'encode' } },
    { title: 'Decode', input: '68 65 6c 6c 6f', options: { mode: 'decode' } },
  ],
  faq: [
    {
      q: 'What input does decoding accept?',
      a: 'Any hex string. Spaces, colons, newlines, 0x and \\x prefixes are ignored, so you can paste output from most tools directly.',
    },
  ],
  related: [  "base64",
  "base32",
  "text-to-binary",
  "unicode-escape"],
  status: 'stable',
};
