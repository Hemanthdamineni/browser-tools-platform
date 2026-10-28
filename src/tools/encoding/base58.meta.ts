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
  related: [  "base64",
  "base32",
  "hex",
  "ascii85"],
  status: 'stable',
};
