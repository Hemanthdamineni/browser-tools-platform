import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'base58',
  name: 'Base58 Encode / Decode',
  category: 'encoding',
  summary: 'Convert text to and from Base58 using the Bitcoin and IPFS alphabet.',
  description:
    'Encode UTF-8 text to Base58 or decode it back, using the Bitcoin/IPFS alphabet (no 0, O, I or l). Leading zero bytes are preserved as leading "1" characters. Big-integer arithmetic keeps every byte exact.',
  keywords: [
    'base58',
    'base 58',
    'bitcoin',
    'ipfs',
    'btc',
    'encode',
    'decode',
    'base58btc',
    'multibase',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Text → Base58' },
        { value: 'decode', label: 'Base58 → Text' },
      ],
    },
  ],
  examples: [
    { title: 'Encode "Hello World!"', input: 'Hello World!', options: { mode: 'encode' } },
    { title: 'Decode', input: '2NEpo7TZRRrLZSi2U', options: { mode: 'decode' } },
    { title: 'Encode a short word', input: 'hello', options: { mode: 'encode' } },
  ],
  faq: [
    {
      q: 'Which alphabet does this use?',
      a: 'The Bitcoin/IPFS alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz. It drops 0, O, I and l so the value is hard to mis-transcribe.',
    },
    {
      q: 'Is this Base58Check?',
      a: 'No. There is no version byte or checksum — it is plain Base58 of the raw bytes. Base58Check (used for Bitcoin addresses) adds a 4-byte double-SHA-256 checksum on top.',
    },
    {
      q: 'Why do some results start with "1"?',
      a: 'Each leading zero byte in the input becomes one leading "1" in the output, because "1" is the zero digit. Decoding turns them back into zero bytes.',
    },
  ],
  article: [
    {
      heading: 'How Base58 encoding works here',
      body: 'The tool turns UTF-8 text into a Base58 string using Bitcoin big-integer arithmetic, or decodes a Base58 string back to text. Encoding reports the input byte count and the output character count; decoding reports the decoded byte count.',
    },
    {
      heading: 'When to use Base58 rather than Base64',
      body: 'It suits short identifiers people copy by hand or read aloud, because dropping 0, O, I and l removes the characters most often confused. That is why Bitcoin addresses and IPFS CIDs use it.',
    },
    {
      heading: 'Choosing the direction',
      body: 'Direction is the only option: Text to Base58 encodes and Base58 to Text decodes. A blank input returns a blank output rather than an error.',
    },
    {
      heading: 'The alphabet rules out some characters',
      body: 'Decoding any character outside the thirty-eight-symbol alphabet raises an error naming the offending character. The output is plain Base58 with no version byte and no checksum, so it is not Base58Check, and leading 1 characters round-trip zero bytes in both directions.',
    },
    {
      heading: 'Everything is computed locally',
      body: 'All conversion is big-integer arithmetic in this tab, so your text is never sent anywhere.',
    },
  ],
  related: ['base64', 'base32', 'hex', 'ascii85'],
  status: 'stable',
};
