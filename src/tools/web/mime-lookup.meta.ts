import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mime-lookup',
  name: 'MIME Type Lookup',
  category: 'web',
  summary: 'Look up the MIME type for an extension, or the extensions for a MIME type.',
  description:
    'Type an extension (png, .tar.gz, photo.png) to get its MIME type and whether it is text or binary, or a MIME type to list every extension registered for it. About 180 common types for images, documents, audio, video, archives, code, fonts and data formats.',
  keywords: [
    'mime type',
    'mime lookup',
    'content type',
    'file extension',
    'mimetype',
    'content-type',
    'media type',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'ext-to-mime',
      choices: [
        { value: 'ext-to-mime', label: 'Extension → MIME' },
        { value: 'mime-to-ext', label: 'MIME → extensions' },
      ],
    },
  ],
  examples: [
    { title: 'Extension', input: 'png' },
    { title: 'MIME type', input: 'application/json', options: { mode: 'mime-to-ext' } },
  ],
  faq: [
    {
      q: 'How are compound extensions like .tar.gz handled?',
      a: 'Only the last extension is matched (.gz → application/gzip). Full compound-extension matching (.tar.gz) is ambiguous and intentionally not attempted.',
    },
  ],
  related: ['data-uri', 'http-status', 'file-metadata'],
  status: 'stable',
};
