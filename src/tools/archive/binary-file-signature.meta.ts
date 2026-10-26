import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'binary-file-signature',
  name: 'File Signature Inspector',
  category: 'archive',
  summary: 'Identify common file formats from their binary signatures, not just extensions.',
  description:
    'Inspect the first 512 bytes of selected files and compare them with known magic-byte signatures. Results are best-effort format hints, not a security verdict; unknown and extensionless files are supported. Files stay on your device.',
  keywords: [
    'file signature',
    'magic bytes',
    'file type detector',
    'identify unknown file',
    'file format inspector',
    'file header',
    'magic number',
    'binary format',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  multiple: true,
  accept: '',
  worker: true,
  examples: [
    { title: 'Identify an extensionless file' },
    { title: 'Check a renamed file against its contents' },
    { title: 'Spot a ZIP-based Office package' },
  ],
  related: ['file-hash', 'mime-lookup'],
  status: 'stable',
};
