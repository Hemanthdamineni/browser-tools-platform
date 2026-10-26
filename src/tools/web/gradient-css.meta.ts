import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gradient-css',
  name: 'CSS Gradient Generator',
  category: 'web',
  summary: 'Build linear, radial and conic CSS gradients with custom colour stops.',
  description:
    'List colour stops (with optional positions) and get a ready-to-paste background-image rule — linear, radial or conic — plus a solid background-color fallback using the first colour.',
  keywords: [
    'css gradient',
    'linear gradient',
    'radial gradient',
    'conic gradient',
    'gradient generator',
    'css background',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'type',
      label: 'Gradient type',
      type: 'select',
      default: 'linear',
      choices: [
        { value: 'linear', label: 'linear' },
        { value: 'radial', label: 'radial' },
        { value: 'conic', label: 'conic' },
      ],
    },
    {
      key: 'angle',
      label: 'Angle (deg)',
      type: 'number',
      default: 90,
      min: 0,
      max: 360,
      showWhen: { key: 'type', value: 'linear' },
    },
    {
      key: 'shape',
      label: 'Radial shape',
      type: 'select',
      default: 'ellipse',
      choices: [
        { value: 'ellipse', label: 'ellipse' },
        { value: 'circle', label: 'circle' },
      ],
      showWhen: { key: 'type', value: 'radial' },
    },
    {
      key: 'stops',
      label: 'Colour stops (one per line: colour [position])',
      type: 'textarea',
      default: '#4f46e5 0%\n#ec4899 100%',
      showWhen: { key: 'type', value: 'linear' },
    },
  ],
  examples: [
    { title: 'Indigo → pink, 90°' },
    {
      title: 'Radial circle',
      options: {
        type: 'radial',
        shape: 'circle',
        stops: '#0f172a 0%\n#38bdf8 100%',
      },
    },
    {
      title: 'Conic colour wheel',
      options: {
        type: 'conic',
        angle: 0,
        stops: 'red 0deg\nlime 120deg\nblue 240deg\nred 360deg',
      },
    },
  ],
  related: ['box-shadow', 'color-palette', 'color-blend'],
  status: 'stable',
};
