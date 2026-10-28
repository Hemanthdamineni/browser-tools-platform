import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'file-join',
  name: 'Join File Chunks',
  category: 'archive',
  summary: 'Join numbered file chunks into one file and verify an optional manifest.',
  description:
    'Combine split file parts locally in natural filename or upload order. If a matching JSON manifest is included, verify its parts and SHA-256 checksum.',
  keywords: ['join', 'merge', 'chunks', 'parts', 'manifest'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [
    {
      key: 'sort',
      label: 'Part order',
      type: 'select',
      default: 'name',
      choices: [
        { value: 'name', label: 'Natural filename order' },
        { value: 'upload-order', label: 'Upload order' },
      ],
    },
    { key: 'outputName', label: 'Output filename', type: 'text', default: 'joined.bin' },
  ],
  examples: [{ title: 'Join split file parts' }],
  related: [  "file-split"],
  status: 'stable',
};
