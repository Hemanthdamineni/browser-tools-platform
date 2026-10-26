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
    {
      title: 'A three-byte string',
      input: '43010203',
    },
  ],
  related: ['ndjson', 'hex', 'binary-file-signature', 'json-format'],
  status: 'stable',
};
