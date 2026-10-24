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
  article: [
    {
      heading: 'Eight bits per byte, UTF-8 underneath',
      body: 'Encoding turns the text into UTF-8 bytes and prints each byte as eight binary digits, so "Hi" becomes 01001000 01101001. Because the bytes are UTF-8, an accented letter produces two bytes and an emoji four, and decoding regroups your 0s and 1s into the same bytes and back into text.',
    },
    {
      heading: 'Grouping and separators',
      body: 'The group option lays out eight bits per group (whole bytes) or four (nibbles), and the separator option puts a space between groups or runs them together. Every combination is valid output and the tool reads back any of them, so a result can be pasted straight into the other direction.',
    },
    {
      heading: 'Decoding rules and errors',
      body: 'Decoding strips every character that is not a 0 or a 1, so spaces, tabs and newlines between blocks are ignored and formatted output pastes directly. The bit count must be a multiple of eight; if it is not, the tool refuses with the number of bits it found and the closest valid length rather than padding or truncating.',
    },
    {
      heading: 'Where it helps, and where it runs',
      body: 'Use it to show how a byte is built, to check a flag mask against the bits a device reports, or to produce binary for a puzzle or serial protocol. It is deliberately not a hex or base64 converter, and input is capped at one million characters. Encoding and decoding use the browser\u2019s own TextEncoder and TextDecoder in this tab, with nothing uploaded.',
    },
  ],
  faq: [
    {
      q: 'How are non-ASCII characters handled?',
      a: 'Text is encoded to UTF-8 bytes first, so é, 中, emoji and every other character becomes its own sequence of 8-bit groups. Decoding groups the bits back into the same UTF-8 bytes.',
    },
    {
      q: 'What if my binary string has the wrong length?',
      a: 'Decoding needs a whole number of bytes. If the input is not a multiple of 8 bits, you get a clear error with the length that would be valid instead of a silently corrupt result.',
    },
    {
      q: 'Can I include spaces or newlines in binary input?',
      a: 'Yes — spaces, tabs and newlines between blocks of 0s and 1s are ignored, so you can paste formatted output directly.',
    },
  ],
  related: ['hex', 'base64', 'ascii85', 'unicode-escape'],
  status: 'stable',
};
