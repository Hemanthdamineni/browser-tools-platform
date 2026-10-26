import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'tar-extract',
  name: 'Extract TAR Archive',
  category: 'archive',
  summary: 'Extract regular files from .tar, .tar.gz and .tgz archives.',
  description:
    'Read ustar archives locally, optionally decompressing gzip-wrapped TAR files, and emit each safe regular file as a download.',
  keywords: ['tar', 'untar', 'extract', 'tar.gz', 'tgz'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.tar,.tar.gz,.tgz,application/x-tar,application/gzip',
  examples: [
    { title: 'Extract a TAR archive' },
    { title: 'Extract a gzipped .tar.gz' },
    { title: 'Extract a .tgz release bundle' },
  ],
  related: ['tar-create', 'zip-extract'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
