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
  examples: [{ title: 'Inspect selected files' }],
  faq: [
    {
      q: 'Can a file signature prove a file is safe?',
      a: 'No. Signatures can suggest a format and expose some extension mismatches, but they do not validate the full contents or establish that a file is safe. Treat unknown or untrusted files cautiously.',
    },
    {
      q: 'Why might the result say unknown?',
      a: 'The inspector checks known signatures at the start of the file, including a few documented offsets. Many text formats and some container variants have no reliable fixed header and will remain unknown.',
    },
    {
      q: 'Does it read or upload the whole file?',
      a: 'No. It reads only the configured leading sample (at most 256 bytes) in your browser, and makes no network request.',
    },
  ],
  related: ['file-metadata', 'mime-lookup', 'base64-file'],
  status: 'stable',
};
