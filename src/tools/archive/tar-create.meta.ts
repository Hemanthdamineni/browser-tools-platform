import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'tar-create', name: 'Create TAR Archive', category: 'archive',
  summary: 'Bundle files into a TAR (optionally gzipped .tar.gz) archive.',
  description: 'Create a ustar-format TAR archive from one or more files. Optionally gzip it to a .tar.gz for smaller downloads.',
  keywords: ['tar', 'tar.gz', 'tgz', 'archive', 'bundle'], privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file', accept: '', multiple: true,
  options: [
    { key: 'tarName', label: 'Archive name', type: 'text', default: 'archive.tar' },
    { key: 'gzip', label: 'Gzip (.tar.gz)', type: 'boolean', default: false },
  ],
  examples: [{ title: 'Create a TAR archive' }], related: ['tar-extract', 'zip-create'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }], status: 'stable',
};
