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
    { key: 'count', label: 'Count', type: 'number', default: 7, min: 3, max: 12 },
  ],
  examples: [
    { title: 'Tints & shades of blue', input: '#3b82f6' },
    { title: 'Complementary', input: '#3b82f6', options: { scheme: 'complementary', count: 2 } },
  ],
  faq: [
    {
      q: 'How many colors do the geometric schemes produce?',
      a: 'Complementary yields 2, triadic 3, tetradic 4, split-complementary 3 - the count option is ignored for those. Tints & shades, monochromatic and analogous fill/repeat to the chosen count.',
    },
  ],
  related: [  "color-convert",
  "gradient-css",
  "color-blend"],
  status: 'stable',
};
