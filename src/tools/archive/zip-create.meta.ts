import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'zip-create',
  name: 'Create ZIP Archive',
  category: 'archive',
  summary: 'Create a ZIP archive from one or more files.',
  description: 'Bundle files into a ZIP archive locally in your browser.',
  keywords: ['zip', 'archive', 'compress', 'bundle'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [
    { key: 'level', label: 'Compression level', type: 'number', default: 6, min: 0, max: 9 },
    { key: 'zipName', label: 'Archive name', type: 'text', default: 'bundle.zip' },
    { key: 'flatten', label: 'Flatten paths', type: 'boolean', default: false },
  ],
  examples: [{ title: 'Create an archive' }],
  related: [  "zip-extract",
  "zip-inspect",
  "tar-create"],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
