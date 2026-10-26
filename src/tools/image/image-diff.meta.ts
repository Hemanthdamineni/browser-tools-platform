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
      help: 'A pixel counts as different when its largest RGBA channel delta exceeds this percentage.',
    },
    {
      key: 'output',
      label: 'Visualization',
      type: 'select',
      default: 'heatmap',
      choices: [
        { value: 'heatmap', label: 'Heatmap' },
        { value: 'highlight', label: 'Highlight' },
        { value: 'side-by-side', label: 'Side by side' },
      ],
    },
  ],
  examples: [
    { title: 'Compare two images' },
    { title: 'Spot tiny differences with a low threshold', options: { threshold: 0 } },
    { title: 'View both images side by side', options: { output: 'side-by-side' } },
  ],
  status: 'stable',
  updated: '2026-10-17',
};
