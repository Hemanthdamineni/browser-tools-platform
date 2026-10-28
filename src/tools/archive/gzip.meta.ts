import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'gzip',
  name: 'Gzip Compress / Decompress',
  category: 'archive',
  summary: 'Compress a file to .gz or decompress a .gz file back to its original bytes.',
  description:
    'Gzip a file locally, or decompress a gzip file. In automatic mode the tool sniffs the gzip magic bytes and picks the direction for you.',
  keywords: ['gzip', 'gunzip', 'compress', 'decompress', 'archive'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: false,
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'compress', label: 'Compress' },
        { value: 'decompress', label: 'Decompress' },
      ],
    },
    {
      key: 'level',
      label: 'Compression level',
      type: 'number',
      default: 6,
      min: 0,
      max: 9,
      showWhen: { key: 'mode', value: 'compress' },
    },
  ],
  examples: [{ title: 'Compress a file' }],
  related: [  "zip-create",
  "base64"],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
