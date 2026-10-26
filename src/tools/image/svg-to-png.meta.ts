import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-to-png',
  name: 'SVG to PNG',
  category: 'image',
  summary: 'Rasterize an SVG image to a downloadable PNG.',
  description:
    'Convert SVG artwork to PNG at a chosen scale or exact size, entirely in your browser. The SVG never leaves your device.',
  keywords: ['svg to png', 'rasterize svg', 'convert vector image', 'svg converter'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/svg+xml,.svg',
  options: [
    {
      key: 'scale',
      label: 'Scale',
      type: 'number',
      default: 2,
      min: 1,
      max: 8,
      help: 'Ignored when a width or height override is set.',
    },
    {
      key: 'width',
      label: 'Width override (0 = SVG size)',
      type: 'number',
      default: 0,
      min: 0,
      max: 16384,
      help: 'Exact output width in pixels; height follows the aspect ratio.',
    },
    {
      key: 'height',
      label: 'Height override (0 = SVG size)',
      type: 'number',
      default: 0,
      min: 0,
      max: 16384,
      help: 'Exact output height in pixels; width follows the aspect ratio.',
    },
    {
      key: 'background',
      label: 'Background (transparent or hex)',
      type: 'text',
      default: 'transparent',
      help: '“transparent”, or a hex colour such as #ffffff behind the artwork.',
    },
  ],
  examples: [
    { title: 'Rasterize SVG at 2×' },
    { title: 'Export at an exact 1200 px width' },
    { title: 'Rasterize at 4× with a white background' },
  ],
  related: ['image-convert', 'image-resize'],
  status: 'stable',
  updated: '2026-10-17',
};
