import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-type',
  name: 'Content-Type Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect HTTP media-type headers, charsets, and multipart boundaries.',
  description:
    'Generate a Content-Type header from a media type and parameters, or parse pasted values into a readable table. Validates media-type tokens, quoted parameters, charsets, and multipart boundary requirements entirely on-device.',
  keywords: [
    'content-type header',
    'media type parser',
    'MIME header builder',
    'charset header',
    'multipart boundary',
    'HTTP content type',
    'application json header',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Parse headers' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'mediaType', label: 'Media type', type: 'text', default: 'application/json' },
    { key: 'charset', label: 'Charset (optional)', type: 'text', default: 'utf-8' },
    { key: 'boundary', label: 'Multipart boundary (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Build JSON content type',
      options: { mode: 'build', mediaType: 'application/json', charset: 'utf-8' },
    },
    {
      title: 'Parse multipart form data',
      input: 'multipart/form-data; boundary="----formBoundary7MA4YWxkTrZu0gW"',
    },
    {
      title: 'Build a multipart boundary header',
      options: {
        mode: 'build',
        mediaType: 'multipart/form-data',
        charset: '',
        boundary: '----formBoundaryABC123',
      },
    },
  ],
  related: ['mime-lookup', 'http-range', 'quoted-printable'],
  status: 'stable',
};
