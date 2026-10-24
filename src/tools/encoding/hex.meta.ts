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
    {
      title: 'Encode with 0x prefixes in uppercase',
      input: 'Hi',
      options: { mode: 'encode', separator: '0x', uppercase: true },
    },
  ],
  faq: [
    {
      q: 'What input does decoding accept?',
      a: 'Any hex string. Spaces, colons, newlines, 0x and \\x prefixes are ignored, so you can paste output from most tools directly.',
    },
    {
      q: 'What counts as one byte when encoding?',
      a: 'Two hex digits. Encoding always works on UTF-8 bytes, so a non-ASCII character such as é becomes two bytes, c3 a9. Decoding refuses an odd number of hex digits outright rather than guessing where the byte boundary falls.',
    },
    {
      q: 'Why do I see replacement characters after decoding?',
      a: 'The decoder always interprets the bytes as UTF-8. Bytes that are not valid UTF-8 are replaced with U+FFFD and the tool adds a note, so a mangled result is flagged instead of quietly returned as if it were correct text.',
    },
  ],
  article: [
    {
      heading: 'Two directions over the same bytes',
      body: 'Encoding reads your text as UTF-8 and prints each byte as two hexadecimal digits; decoding does the reverse, parsing hex pairs back into bytes and decoding them as UTF-8 text. Nothing is interpreted as a number, so an arbitrary character string survives the trip unchanged.',
    },
    {
      heading: 'Choosing separators and case',
      body: 'The separator option shapes encoding output for whichever consumer you have: no separator for a compact blob, a space or colon between bytes for logs and certificates, a 0x prefix for C-style arrays and \\x for Python or shell escapes. Uppercase switches the digits themselves. In decode direction the separators do not matter — all of them are stripped before parsing.',
    },
    {
      heading: 'Errors it catches for you',
      body: 'An odd number of hex digits is rejected with an explanation instead of being padded, because a missing nibble means the input was truncated. On decode, bytes that are not valid UTF-8 produce U+FFFD replacement characters and the result carries a note, which tells you the payload was probably binary or in another encoding.',
    },
    {
      heading: 'Byte-for-byte local conversion',
      body: 'Both directions use the TextEncoder and TextDecoder built into the browser, so no library is downloaded and no request leaves the page. You can paste private keys or tokens here to inspect their bytes without the value being transmitted anywhere.',
    },
  ],
  related: ['base64', 'base32', 'text-to-binary', 'quoted-printable'],
  status: 'stable',
};
