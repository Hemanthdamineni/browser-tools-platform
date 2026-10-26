import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-disposition',
  name: 'Content-Disposition Builder & Parser',
  category: 'web',
  summary: 'Build or inspect Content-Disposition download and inline headers.',
  description:
    'Generate a safe Content-Disposition response header for inline display or downloads, or parse pasted headers to inspect disposition, filename, and filename* parameters. Processing stays in your browser.',
  keywords: [
    'content-disposition',
    'download header',
    'filename header',
    'attachment header',
    'inline header',
    'RFC 6266',
    'filename star',
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
    {
      key: 'disposition',
      label: 'Disposition',
      type: 'select',
      default: 'attachment',
      choices: [
        { value: 'attachment', label: 'attachment (download)' },
        { value: 'inline', label: 'inline (display)' },
      ],
    },
    { key: 'filename', label: 'Filename', type: 'text', default: 'download.bin' },
  ],
  examples: [
    {
      title: 'Build a Unicode download header',
      options: { mode: 'build', disposition: 'attachment', filename: 'résumé 2025.pdf' },
    },
    {
      title: 'Parse a response header',
      input: 'attachment; filename="report.pdf"; filename*=UTF-8\'\'report%20final.pdf',
    },
    {
      title: 'Inline display header',
      options: { mode: 'build', disposition: 'inline', filename: 'invoice-2026.pdf' },
    },
  ],
  related: ['mime-lookup', 'url-encode', 'set-cookie'],
  status: 'stable',
};
