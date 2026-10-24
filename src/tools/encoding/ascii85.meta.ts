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
  article: [
    {
      heading: 'How Ascii85 packs bytes',
      body: 'Text is encoded as UTF-8 first, then every four bytes become five printable characters from an 85-character alphabet — about 25% larger than the raw bytes, noticeably tighter than Base64. Decoding reverses this and returns the UTF-8 text, with the byte count shown.',
    },
    {
      heading: 'Three variants, three alphabets',
      body: 'The Adobe variant wraps the output in <~ and ~> and writes a group of four zero bytes as a single z, which is what PostScript and PDF streams use. The btoa variant adds a y shorthand for four spaces and omits the delimiters. Z85 is the ZeroMQ RFC 32 alphabet, defined only for lengths that are a multiple of four.',
    },
    {
      heading: 'Choosing a variant by destination',
      body: 'Pick Adobe when feeding a PostScript or PDF filter, or when you want the delimiters included. Pick btoa to match the historical btoa command. Pick Z85 when the other end is a ZeroMQ socket — and remember the multiple-of-four rule.',
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'On decode the Adobe delimiters and any whitespace are stripped automatically. A dangling single-character group is an error, since a partial group needs at least two. Decoding does not verify valid UTF-8, so the byte count is the reliable check.',
    },
    {
      heading: 'Encoded in the browser',
      body: 'The conversion is pure arithmetic in this tab, with no request to any service. That matters when the input is a binary blob embedded in a PDF or a licence payload you would rather not paste elsewhere.',
    },
  ],
  faq: [
    {
      q: 'What is the "z" shorthand?',
      a: 'In the Adobe and btoa variants a group of four zero bytes is written as a single "z" instead of "!!!!!". The btoa variant additionally writes four spaces as "y".',
    },
    {
      q: 'Why does Z85 reject my input?',
      a: 'Z85 (ZeroMQ RFC 32) is only defined for byte lengths that are a multiple of 4, and encoded lengths that are a multiple of 5. It has no padding, so partial groups are an error.',
    },
    {
      q: 'Does the Adobe variant need the <~ ~> delimiters?',
      a: 'When decoding they are optional — the tool strips them if present. When encoding with the Adobe variant they are always added.',
    },
  ],
  related: ['base64', 'base32', 'base58', 'hex'],
  status: 'stable',
};
