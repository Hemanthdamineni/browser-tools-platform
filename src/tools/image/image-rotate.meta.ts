import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-rotate',
  name: 'Rotate / Flip Image',
  category: 'image',
  summary: 'Rotate images by 90-degree steps or flip them horizontally and vertically.',
  description:
    'Rotate or mirror one or more images in your browser without sending files to a server. Choose a 90-degree rotation, flip horizontally or vertically, and export as PNG, JPEG or WebP.',
  keywords: ['rotate image', 'flip image', 'mirror photo', 'image orientation'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'rotate',
      label: 'Rotation',
      help: 'Quarter turns are applied clockwise.',
      type: 'select',
      default: '0',
      choices: ['0', '90', '180', '270'].map((value) => ({ value, label: `${value}°` })),
    },
    {
      key: 'flip',
      label: 'Flip',
      type: 'select',
      default: 'none',
      choices: ['none', 'horizontal', 'vertical', 'both'].map((value) => ({ value, label: value })),
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'original',
      choices: ['original', 'png', 'jpeg', 'webp'].map((value) => ({ value, label: value })),
    },
  ],
  examples: [{ title: 'Rotate 90°', options: { rotate: '90' } }],
  faq: [
    {
      q: 'Which way does 90° rotate?',
      a: 'Clockwise, matching how most photo apps label a quarter turn.',
    },
    {
      q: 'Are my images uploaded?',
      a: 'No. Rotation runs on a canvas in your browser and nothing leaves your device.',
    },
    {
      q: 'What about phone photos that look sideways?',
      a: 'EXIF orientation is applied while decoding, so an upright photo stays upright. Exporting to JPEG flattens transparency onto white.',
    },
  ],
  related: ['image-crop', 'image-resize'],
  status: 'stable',
  updated: '2026-10-17',
};
