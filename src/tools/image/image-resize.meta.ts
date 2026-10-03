import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-resize',
  name: 'Resize Image',
  category: 'image',
  summary: 'Resize images by percentage or to exact dimensions, entirely in your browser.',
  description:
    'Scale PNG, JPEG or WebP images while preserving aspect ratio or forcing exact dimensions. Processing stays on your device.',
  keywords: ['resize image', 'image scale', 'shrink photo', 'dimensions', 'pixels'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'mode',
      label: 'Sizing mode',
      type: 'select',
      default: 'fit',
      choices: ['fit', 'fill', 'exact', 'percent', 'max-width', 'max-height'].map((value) => ({
        value,
        label: value,
      })),
    },
    { key: 'width', label: 'Width (px)', type: 'number', default: 800, min: 1, max: 8192 },
    { key: 'height', label: 'Height (px)', type: 'number', default: 600, min: 1, max: 8192 },
    {
      key: 'percent',
      label: 'Scale (%)',
      type: 'number',
      default: 50,
      min: 1,
      max: 400,
      showWhen: { key: 'mode', value: 'percent' },
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'original',
      choices: ['original', 'png', 'jpeg', 'webp'].map((value) => ({ value, label: value })),
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      max: 100,
      showWhen: { key: 'format', value: 'jpeg' },
    },
    { key: 'upscale', label: 'Allow upscaling', type: 'boolean', default: false },
  ],
  examples: [{ title: 'Fit within 800 × 600', options: { mode: 'fit', width: 800, height: 600 } }],
  faq: [{ q: 'Are images uploaded?', a: 'No. Images are processed locally in your browser.' }],
  related: ['image-compress', 'image-convert', 'image-crop'],
  status: 'beta',
};
