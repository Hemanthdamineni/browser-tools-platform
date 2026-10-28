import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'placeholder-svg',
  name: 'Placeholder Image Generator',
  category: 'generators',
  summary:
    'Generate sized SVG placeholder images with a custom label and colours for layouts and mockups.',
  description:
    'Create “W×H” placeholder boxes as SVG for wireframes, prototypes and missing-image fallbacks. Set the size, background and text colour, and override the label.',
  keywords: [
    'placeholder image',
    'svg placeholder',
    'dummy image',
    'wireframe',
    'mockup image',
    'image fallback',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'width', label: 'Width (px)', type: 'number', default: 600, min: 16 },
    { key: 'height', label: 'Height (px)', type: 'number', default: 400, min: 16 },
    { key: 'bg', label: 'Background colour', type: 'text', default: '#e2e8f0' },
    { key: 'fg', label: 'Text colour', type: 'text', default: '#64748b' },
    { key: 'label', label: 'Label (empty = WxH)', type: 'text', default: '' },
    {
      key: 'fontSize',
      label: 'Font size (0 = auto)',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    { title: '600 × 400 default', options: { width: 600, height: 400 } },
    { title: 'Hero banner', options: { width: 1200, height: 300, label: 'Hero' } },
    {
      title: 'Dark square avatar slot',
      options: { width: 256, height: 256, bg: '#1e293b', fg: '#f8fafc', label: 'Avatar' },
    },
  ],
  related: ['qr-code', 'data-uri', 'image-resize'],
  status: 'stable',
};
