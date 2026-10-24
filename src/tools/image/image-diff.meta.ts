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
  faq: [
    {
      q: 'Do both images need the same dimensions?',
      a: 'No. The second image is scaled to the first image dimensions before comparison, and a note is added when the sizes differ. Scaling can shift edges, so a crop-to-crop comparison is more accurate than one across differently sized renders.',
    },
    {
      q: 'What counts as a differing pixel?',
      a: 'A pixel is different when its largest channel delta across all four RGBA channels exceeds the threshold percentage. Transparency is compared too, so a change from opaque to transparent is a difference.',
    },
    {
      q: 'Which file is produced?',
      a: 'The tool returns a single PNG called image-diff.png. Heatmap and highlight show the first image with differences overlaid; side-by-side places the two inputs next to each other.',
    },
  ],
  status: 'stable',
  updated: '2026-10-17',
};
