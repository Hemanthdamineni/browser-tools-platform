import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-palette',
  name: 'Color Palette Generator',
  category: 'color',
  summary: 'Generate tints, shades, complementary, triadic and analogous color palettes.',
  description:
    'Pick a base color and a scheme - tints & shades, monochromatic, complementary, analogous, triadic, tetradic or split-complementary - and get a palette of harmonious colors as clickable swatches.',
  keywords: [
    'color palette',
    'palette generator',
    'tints and shades',
    'complementary colors',
    'triadic',
    'analogous colors',
    'color scheme',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'scheme',
      label: 'Scheme',
      type: 'select',
      default: 'tints-shades',
      choices: [
        { value: 'tints-shades', label: 'Tints & shades' },
        { value: 'monochromatic', label: 'Monochromatic' },
        { value: 'complementary', label: 'Complementary' },
        { value: 'analogous', label: 'Analogous' },
        { value: 'triadic', label: 'Triadic' },
        { value: 'tetradic', label: 'Tetradic' },
        { value: 'split-complementary', label: 'Split-complementary' },
      ],
    },
    { key: 'count', label: 'Count', type: 'number', default: 7, min: 3 },
  ],
  examples: [
    { title: 'Tints & shades of blue', input: '#3b82f6' },
    { title: 'Complementary', input: '#3b82f6', options: { scheme: 'complementary', count: 2 } },
    {
      title: 'Triadic from a named colour',
      input: 'teal',
      options: { scheme: 'triadic', count: 3 },
    },
    {
      title: 'Analogous in rgb() notation',
      input: 'rgb(200, 120, 40)',
      options: { scheme: 'analogous', count: 5 },
    },
  ],
  related: ['color-convert', 'gradient-css', 'color-blend'],
  status: 'stable',
};
