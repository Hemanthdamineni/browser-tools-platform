import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'image-rotate',
  name: 'Rotate / Flip Image',
  category: 'image',
  summary: 'Rotate images by 90-degree steps or flip them horizontally and vertically.',
  description:
    'Rotate or mirror one or more images in your browser without sending files to a server.',
  keywords: ['rotate image', 'flip image', 'mirror photo', 'image orientation'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'rotate',
      label: 'Rotation',
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
  examples: [{ title: 'Rotate 90°' }],
  related: ['image-crop', 'image-resize'],
  status: 'beta',
};
