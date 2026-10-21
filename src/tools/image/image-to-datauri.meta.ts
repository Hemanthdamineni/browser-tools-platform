import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'image-to-datauri',
  name: 'Image to Data URI',
  category: 'image',
  summary: 'Encode an image as a data URI for HTML, CSS, or source code.',
  description:
    'Create a base64 data URI locally, with optional HTML image or CSS background wrappers.',
  keywords: ['image data uri', 'base64 image', 'embed image', 'inline image'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  options: [
    {
      key: 'wrap',
      label: 'Output wrapper',
      type: 'select',
      default: 'raw',
      choices: [
        { value: 'raw', label: 'Raw data URI' },
        { value: 'css-background', label: 'CSS background' },
        { value: 'html-img', label: 'HTML img' },
      ],
    },
    {
      key: 'mediaQueryComment',
      label: 'Include media query comment',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [{ title: 'Encode an image' }],
  related: ['datauri-to-image', 'data-uri', 'base64'],
  status: 'beta',
};
