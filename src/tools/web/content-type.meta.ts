import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-type',
  name: 'Content-Type Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect HTTP media-type headers, charsets, and multipart boundaries.',
  description: 'Generate a Content-Type header from a media type and parameters, or parse pasted values into a readable table. Validates media-type tokens, quoted parameters, charsets, and multipart boundary requirements entirely on-device.',
  keywords: ['content-type header', 'media type parser', 'MIME header builder', 'charset header', 'multipart boundary', 'HTTP content type', 'application json header'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'parse', choices: [{ value: 'parse', label: 'Parse headers' }, { value: 'build', label: 'Build header' }] },
    { key: 'mediaType', label: 'Media type', type: 'text', default: 'application/json' },
    { key: 'charset', label: 'Charset (optional)', type: 'text', default: 'utf-8' },
    { key: 'boundary', label: 'Multipart boundary (optional)', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Build JSON content type', options: { mode: 'build', mediaType: 'application/json', charset: 'utf-8' } },
    { title: 'Parse multipart form data', input: 'multipart/form-data; boundary="----formBoundary7MA4YWxkTrZu0gW"' },
  ],
  faq: [
    { q: 'Should JSON include a charset?', a: 'UTF-8 is the standard encoding for JSON, and many APIs send application/json without a charset. Either form is commonly accepted.' },
    { q: 'Why does multipart need a boundary?', a: 'The boundary separates parts in the body. The server must use the same boundary value in the body delimiters.' },
    { q: 'Does this inspect the body encoding?', a: 'No. It only parses or builds the header value and cannot infer how an external body was actually encoded.' },
  ],
  related: ['mime-lookup', 'http-range', 'quoted-printable'],
  status: 'stable',
};
