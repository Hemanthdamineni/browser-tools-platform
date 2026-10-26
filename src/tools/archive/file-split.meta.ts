import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'file-split',
  name: 'Split File into Chunks',
  category: 'archive',
  summary: 'Split a large file into numbered part chunks plus a JSON manifest.',
  description:
    'Slice a file into `.part001`, `.part002`… chunks with a tiny manifest that records the original name, size, SHA-256 and part list so a later join can verify integrity.',
  keywords: ['split', 'chunk', 'parts', 'manifest', 'large file'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'by-size',
      choices: [
        { value: 'by-size', label: 'By chunk size' },
        { value: 'by-count', label: 'By number of parts' },
      ],
    },
    {
      key: 'chunkSize',
      label: 'Chunk size',
      type: 'number',
      default: 5,
      min: 1,
      showWhen: { key: 'mode', value: 'by-size' },
    },
    {
      key: 'chunkUnit',
      label: 'Unit',
      type: 'select',
      default: 'MB',
      choices: [
        { value: 'KB', label: 'KB' },
        { value: 'MB', label: 'MB' },
      ],
      showWhen: { key: 'mode', value: 'by-size' },
    },
    {
      key: 'count',
      label: 'Number of parts',
      type: 'number',
      default: 4,
      min: 2,
      showWhen: { key: 'mode', value: 'by-count' },
    },
  ],
  examples: [
    { title: 'Split a file' },
    { title: 'Split by count into four parts', options: { mode: 'by-count', count: 4 } },
    {
      title: 'Split into 1 KB chunks',
      options: { mode: 'by-size', chunkSize: 1, chunkUnit: 'KB' },
    },
  ],
  related: ['file-join', 'file-metadata'],
  status: 'stable',
};
