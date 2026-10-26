import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'file-signature',
  name: 'File Signature Inspector',
  category: 'archive',
  summary: 'Identify common file formats from their bytes instead of trusting the extension.',
  description:
    'Inspect the leading bytes of selected files to identify common document, image, archive, audio, executable and database formats. Compare the detected format with the filename extension and browser-reported MIME type. Only a small header sample is read locally.',
  keywords: [
    'file signature',
    'magic bytes',
    'file type detection',
    'file format inspector',
    'mime verification',
    'extension mismatch',
    'identify unknown file',
    'magic number',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [
    {
      key: 'sampleBytes',
      label: 'Header sample size',
      type: 'select',
      default: '64',
      choices: [
        { value: '32', label: '32 bytes' },
        { value: '64', label: '64 bytes' },
        { value: '256', label: '256 bytes' },
      ],
    },
  ],
  examples: [
    { title: 'Inspect selected files' },
    { title: 'Spot a renamed download' },
    { title: 'Read a wider header sample', options: { sampleBytes: '256' } },
  ],
  related: ['file-metadata', 'mime-lookup', 'base64'],
  status: 'stable',
};
