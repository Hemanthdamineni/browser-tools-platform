import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'data-uri',
  name: 'Data URI Converter',
  category: 'web',
  summary: 'Encode text as a data: URI, or decode a data: URI back to text.',
  description:
    'Turn text into a self-contained data: URL (base64 or percent-encoded) with your chosen MIME type and charset, or paste a data: URI to see its MIME type, parameters and decoded payload.',
  keywords: [
    'data uri',
    'data url',
    'data:text/html',
    'base64 encode',
    'inline file',
    'mhtml',
    'data uri decoder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Encode → data: URI' },
        { value: 'decode', label: 'Decode data: URI' },
      ],
    },
    {
      key: 'mimeType',
      label: 'MIME type',
      type: 'text',
      default: 'text/plain',
      showWhen: { key: 'mode', value: 'encode' },
    },
    {
      key: 'charset',
      label: 'Append ;charset=utf-8',
      type: 'boolean',
      default: true,
      showWhen: { key: 'mode', value: 'encode' },
    },
    {
      key: 'encoding',
      label: 'Payload encoding',
      type: 'select',
      default: 'base64',
      choices: [
        { value: 'base64', label: 'base64' },
        { value: 'url', label: 'percent-encoded' },
      ],
      showWhen: { key: 'mode', value: 'encode' },
    },
  ],
  examples: [
    {
      title: 'Inline SVG',
      input: '<svg/>',
      options: { mode: 'encode', mimeType: 'image/svg+xml' },
    },
    { title: 'Decode', input: 'data:text/plain,hello%20world', options: { mode: 'decode' } },
  ],
  faq: [
    {
      q: 'Why base64 instead of percent-encoding?',
      a: 'base64 grows the payload by ~33% but never needs escaping; percent-encoding is shorter for mostly-ASCII text. Both are valid per RFC 2397.',
    },
  ],
  related: ['base64', 'url-encode', 'image-to-datauri'],
  status: 'stable',
};
