import type { ToolMeta } from '@/lib/types';

/**
 * Legacy id. The tool was merged into `base64`, which now handles both text
 * and files. The id stays routable so old links and bookmarks keep working —
 * the page redirects to the merged tool.
 */
export const meta: ToolMeta = {
  id: 'base64-file',
  name: 'File to Base64',
  category: 'archive',
  summary: 'Encode a file as Base64 text or decode Base64 into a file.',
  description:
    'Convert files to Base64 locally, or decode Base64 text back into a downloadable file.',
  keywords: ['base64', 'encode', 'decode', 'file', 'binary'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'encode',
      choices: [
        { value: 'encode', label: 'Encode file' },
        { value: 'decode', label: 'Decode Base64 text file' },
      ],
    },
    { key: 'outputName', label: 'Decoded filename', type: 'text', default: 'decoded.bin' },
  ],
  examples: [{ title: 'Encode or decode a file' }],
  related: [  "base64"],
  status: 'stable',
  hidden: true,
  redirectTo: 'base64',
};
