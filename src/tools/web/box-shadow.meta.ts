import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'box-shadow',
  name: 'CSS Box Shadow Generator',
  category: 'web',
  summary: 'Generate box-shadow rules — single or layered soft shadows.',
  description:
    'Configure offset, blur, spread, colour and inset to get a ready-to-paste box-shadow rule. Optional layered mode emits a stack of progressively larger, softer shadows for a natural elevation look.',
  keywords: [
    'box shadow',
    'css shadow',
    'shadow generator',
    'elevation',
    'material shadow',
    'layered shadow',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'offsetX', label: 'Offset X (px)', type: 'number', default: 0 },
    { key: 'offsetY', label: 'Offset Y (px)', type: 'number', default: 4 },
    { key: 'blur', label: 'Blur (px)', type: 'number', default: 12, min: 0 },
    { key: 'spread', label: 'Spread (px)', type: 'number', default: 0 },
    { key: 'color', label: 'Colour', type: 'text', default: 'rgba(0,0,0,0.15)' },
    { key: 'inset', label: 'Inset', type: 'boolean', default: false },
    { key: 'layers', label: 'Layers', type: 'number', default: 1, min: 1, max: 6 },
  ],
  examples: [
    { title: 'Default elevation' },
    { title: 'Layered (3 layers)', options: { layers: 3 } },
  ],
  faq: [
    {
      q: 'How does layered mode scale the shadows?',
      a: 'Layer i of N uses offset/blur/spread multiplied by i/N and the colour alpha divided by i. It mimics the multi-shadow "elevation" technique popularised by Material Design.',
    },
  ],
  related: ['gradient-css', 'color-blend'],
  status: 'stable',
};
