import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'file-metadata',
  name: 'File Metadata',
  category: 'archive',
  summary: 'Inspect file names, sizes, MIME types, timestamps and SHA-256 hashes.',
  description:
    'Report metadata for one or more selected files locally: name, size, MIME type, last-modified time and a SHA-256 hash for integrity checks.',
  keywords: ['file metadata', 'mime type', 'size', 'sha256', 'modified'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [{ key: 'hash', label: 'Compute SHA-256', type: 'boolean', default: true }],
  examples: [{ title: 'Inspect file metadata' }],
  related: ['file-split', 'base64'],
  status: 'stable',
};
