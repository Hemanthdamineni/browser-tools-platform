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
  related: ['base64', 'base32', 'hex', 'ascii85'],
  status: 'stable',
};
