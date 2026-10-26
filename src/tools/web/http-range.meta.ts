import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-range',
  name: 'HTTP Range Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect byte-range request and response headers.',
  description:
    'Generate Range or Content-Range headers, or parse pasted range values with a known representation size. Validates byte positions, suffix ranges, unsatisfiable ranges, and wildcard totals without network access.',
  keywords: [
    'HTTP Range header',
    'Content-Range',
    'Accept-Ranges',
    'byte range',
    'partial content',
    '206 range request',
    '416 range not satisfiable',
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
        { value: 'parse', label: 'Parse range values' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'header',
      label: 'Header type',
      type: 'select',
      default: 'range',
      choices: [
        { value: 'range', label: 'Range request' },
        { value: 'content-range', label: 'Content-Range response' },
        { value: 'accept-ranges', label: 'Accept-Ranges response' },
      ],
    },
    { key: 'start', label: 'Start byte', type: 'number', default: 0, min: 0 },
    { key: 'end', label: 'End byte (inclusive, -1 = open)', type: 'number', default: -1, min: -1 },
    {
      key: 'size',
      label: 'Representation size bytes (0 = unknown)',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    { title: 'Parse a request range', input: 'bytes=0-999' },
    {
      title: 'Build a range request',
      options: { mode: 'build', header: 'range', start: 0, end: 1023 },
    },
    {
      title: 'Build a partial response range',
      options: { mode: 'build', header: 'content-range', start: 100, end: 199, size: 1000 },
    },
  ],
  related: ['http-status', 'content-disposition', 'content-length-app'],
  status: 'stable',
};
