import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cbor-decoder',
  name: 'CBOR Decoder',
  category: 'encoding',
  summary: 'Decode CBOR into readable JSON, with a structure outline and tag interpretation.',
  description:
    'Turn Concise Binary Object Representation back into something you can read. Drop in a .cbor file or paste a hex or base64 dump and see the decoded value, a path-by-path outline of every item with its type, and interpreted tags such as dates, epoch times and bignums. Handy for WebAuthn, COSE, IoT payloads and CBOR sequences.',
  keywords: [
    'cbor',
    'cbor decoder',
    'decode cbor',
    'rfc 8949',
    'webauthn cbor',
    'cose',
    'binary object representation',
    'cbor to json',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.cbor,.bin,application/cbor,application/octet-stream',
  acceptsText: true,
  options: [
    {
      key: 'inputFormat',
      label: 'Pasted text format',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Detect automatically' },
        { value: 'hex', label: 'Hexadecimal' },
        { value: 'base64', label: 'Base64' },
      ],
      default: 'auto',
    },
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'json', label: 'Decoded value' },
        { value: 'table', label: 'Structure outline' },
      ],
      default: 'json',
    },
    {
      key: 'interpretTags',
      label: 'Interpret tags (dates, bignums)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A small map',
      input: 'a26161016162820203',
    },
    {
      title: 'An epoch time with tag 1',
      input: 'c11a514b67b0',
    },
  ],
  faq: [
    {
      q: 'How are byte strings shown?',
      a: 'JSON has no byte type, so byte strings appear as {"$bytes":"0102"} with the content in hexadecimal. Nothing is lost and the marker makes it obvious which values were binary.',
    },
    {
      q: 'Why do I see NaN and $undefined in the output?',
      a: 'CBOR can carry NaN, infinity and undefined, none of which strict JSON allows. Rather than silently turning them into null, the decoder writes them literally so you can see what was really in the data.',
    },
    {
      q: 'What happens with CBOR sequences?',
      a: 'If more than one top-level item is present, each is decoded and printed on its own line in order, exactly as RFC 8742 describes. The item count is reported in the statistics.',
    },
    {
      q: 'Which tags are interpreted?',
      a: 'Tag 0 becomes an ISO date from its text, tag 1 becomes an ISO date from epoch seconds, tags 2 and 3 become decimal bignum strings, and tag 24 is decoded as embedded CBOR. Every other tag is kept as {"$tag":n,"value":...} so nothing is hidden.',
    },
  ],
  related: ['ndjson', 'hex', 'binary-file-signature', 'json-format'],
  status: 'stable',
};
