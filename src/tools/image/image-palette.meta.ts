import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-palette',
  name: 'Extract Colour Palette',
  category: 'image',
  summary: 'Extract the dominant colour palette from an image locally.',
  description:
    'Sample an image and produce a palette of representative colours using median-cut, k-means or most-frequent quantization. Pixels are analysed in your browser only.',
  keywords: ['image palette', 'extract colors', 'dominant colors', 'color palette image'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    { key: 'colors', label: 'Number of colours', type: 'number', default: 6, min: 2 },
    {
      key: 'algorithm',
      label: 'Algorithm',
      help: 'Median-cut balances coverage; k-means groups similar colours; most-frequent keeps the most common buckets.',
      type: 'select',
      default: 'median-cut',
      choices: ['median-cut', 'k-means', 'most-frequent'].map((value) => ({ value, label: value })),
    },
  ],
  examples: [
    { title: 'Extract 6 colours' },
    {
      title: 'Eight colours with k-means',
      options: { colors: 8, algorithm: 'k-means' },
    },
    {
      title: 'Dominant colour from a small palette',
      options: { colors: 3, algorithm: 'most-frequent' },
    },
  ],
  related: ['color-palette', 'color-name', 'image-metadata'],
  status: 'stable',
  updated: '2026-10-17',
};
