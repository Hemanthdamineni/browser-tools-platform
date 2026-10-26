import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ascii85',
  name: 'Ascii85 / Base85',
  category: 'encoding',
  summary: 'Encode and decode Ascii85 / Base85 text in the Adobe, btoa and Z85 variants.',
  description:
    'Convert UTF-8 text to and from Ascii85 (also called Base85). Pick the Adobe variant (<~ ~> delimiters, "z" shorthand for zero groups), the classic btoa variant, or ZeroMQ Z85. Four bytes pack into five printable characters.',
  keywords: [
    'ascii85',
    'base85',
    'adobe ascii85',
    'btoa',
    'z85',
    'zeromq',
    'encode',
    'decode',
    'postscript',
    'pdf',
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
        { value: 'encode', label: 'Text → Ascii85' },
        { value: 'decode', label: 'Ascii85 → Text' },
      ],
    },
    {
      key: 'variant',
      label: 'Variant',
      type: 'select',
      default: 'adobe',
      choices: [
        { value: 'adobe', label: 'Adobe (<~ ~>, z shorthand)' },
        { value: 'btoa', label: 'btoa (z and y shorthand, no delimiters)' },
        { value: 'z85', label: 'Z85 (ZeroMQ, length must be a multiple of 4)' },
      ],
    },
  ],
  examples: [
    { title: 'Encode (Adobe)', input: 'Man is', options: { mode: 'encode', variant: 'adobe' } },
    {
      title: 'Decode (Adobe)',
      input: '<~9jqo^Bla~>',
      options: { mode: 'decode', variant: 'adobe' },
    },
    { title: 'Encode Z85 (4 bytes)', input: 'test', options: { mode: 'encode', variant: 'z85' } },
  ],
  related: ['base64', 'base32', 'base58', 'hex'],
  status: 'stable',
};
