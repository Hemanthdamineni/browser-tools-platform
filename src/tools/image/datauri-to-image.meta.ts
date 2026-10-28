import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'datauri-to-image',
  name: 'Data URI to Image',
  category: 'image',
  summary: 'Decode an image data URI from a text file into an image file.',
  description:
    'Paste a data URI into a text file and decode it locally into a downloadable image. The tool is now a mode of the unified Data URI Converter; this URL redirects there.',
  keywords: ['data uri to image', 'decode base64 image', 'data url decoder', 'extract image'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  examples: [{ title: 'Decode an image data URI' }],
  related: [  "data-uri",
  "base64",
  "url-encode"],
  hidden: true,
  redirectTo: 'data-uri',
  status: 'beta',
};
