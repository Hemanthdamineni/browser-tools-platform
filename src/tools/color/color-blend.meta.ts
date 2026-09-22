import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-blend',
  name: 'Color Blender',
  category: 'color',
  summary: 'Mix two colors in RGB or HSL space with a 0-100% blend ratio.',
  description:
    'Pick two colors and a blend ratio to see the midpoint color in RGB or HSL space. HSL blending follows the shorter path around the hue wheel, so red-to-blue passes through magenta, not green.',
  keywords: [
    'color blend',
    'color mix',
    'mix colors',
    'interpolate color',
    'lerp color',
    'midpoint color',
    'gradient midpoint',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'second', label: 'Second color', type: 'text', default: '#ffffff' },
    {
      key: 'ratio',
      label: 'Blend ratio (%)',
      help: '0% is all the first color, 100% is all the second.',
      type: 'range',
      default: 50,
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: 'space',
      label: 'Blend space',
      type: 'select',
      default: 'rgb',
      choices: [
        { value: 'rgb', label: 'RGB (per channel)' },
        { value: 'hsl', label: 'HSL (hue, saturation, lightness)' },
      ],
    },
  ],
  examples: [
    { title: 'Black to white', input: '#000000' },
    { title: 'Halfway to blue', input: '#ff0000', options: { second: '#0000ff' } },
    { title: 'HSL blend', input: 'red', options: { second: 'blue', space: 'hsl' } },
  ],
  faq: [
    {
      q: 'Why does RGB blending look dark in the middle?',
      a: 'RGB blends each channel linearly, which can produce muddy midpoints. HSL blending moves around the hue wheel instead and often looks more natural for vivid colors.',
    },
  ],
  related: ['color-palette', 'gradient-css', 'color-convert'],
  status: 'stable',
};
