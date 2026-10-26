import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'url-encode',
  name: 'URL Encode / Decode',
  category: 'encoding',
  summary: 'Percent-encode or decode text for use in URLs — component or whole-URL mode.',
  description:
    'Escape text so it is safe inside a URL, or turn percent-escapes back into readable text. "Component" escapes everything reserved; "whole URL" keeps :/?#[]@ intact.',
  keywords: [
    'url encode',
    'percent encode',
    'uri',
    'encodeURIComponent',
    'decodeURIComponent',
    'escape',
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
        { value: 'encode', label: 'Text → URL-encoded' },
        { value: 'decode', label: 'URL-encoded → Text' },
      ],
    },
    {
      key: 'scope',
      label: 'Scope',
      type: 'select',
      default: 'component',
      choices: [
        { value: 'component', label: 'Component (encode everything reserved)' },
        { value: 'full', label: 'Whole URL (keep : / ? # [ ] @)' },
      ],
    },
    {
      key: 'plusSpace',
      label: 'Treat + as space (decode)',
      type: 'boolean',
      default: false,
      help: 'For application/x-www-form-urlencoded data.',
      showWhen: { key: 'mode', value: 'decode' },
    },
  ],
  examples: [
    { title: 'Encode a query value', input: 'name=John Doe & Co.', options: { mode: 'encode' } },
    { title: 'Decode', input: 'caf%C3%A9%20%26%20cr%C3%A8me', options: { mode: 'decode' } },
    {
      title: 'Encode a full URL without breaking it',
      input: 'https://example.com/search?q=blue shoes&page=2',
      options: { mode: 'encode', scope: 'full' },
    },
    {
      title: 'Decode a form-encoded body',
      input: 'first_name=John+Doe&city=New+York',
      options: { mode: 'decode', plusSpace: true },
    },
  ],
  related: ['base64', 'html-entities', 'querystring', 'url-parse'],
  status: 'stable',
};
