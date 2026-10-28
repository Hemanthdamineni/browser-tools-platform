import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'zip-inspect',
  name: 'Inspect ZIP Archive',
  category: 'archive',
  summary: 'Inspect the files, sizes and compression ratio inside a ZIP archive.',
  description:
    'Read the ZIP directory locally and display each entry with its uncompressed size, compressed size, ratio, CRC-32 and modified date.',
  keywords: ['zip', 'inspect', 'archive', 'directory', 'contents'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.zip,application/zip',
  examples: [{ title: 'Inspect a ZIP' }],
  related: [  "zip-extract",
  "file-metadata"],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
