import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-diff',
  name: 'Image Difference',
  category: 'image',
  summary: 'Compare two images and visualize their pixel differences.',
  description:
    'Compare two images locally, export a heatmap/highlight/side-by-side PNG, and inspect difference statistics. Nothing is uploaded.',
  keywords: ['image diff', 'compare images', 'visual difference', 'pixel comparison'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'threshold',
      label: 'Difference threshold (%)',
      type: 'range',
      default: 10,
      min: 0,
      max: 100,
    },
    {
      key: 'output',
      label: 'Visualization',
      type: 'select',
      default: 'heatmap',
      choices: ['heatmap', 'highlight', 'side-by-side'].map((value) => ({ value, label: value })),
    },
  ],
  examples: [{ title: 'Compare two images' }],
  related: ['diff-text', 'image-metadata'],
  status: 'stable',
};
