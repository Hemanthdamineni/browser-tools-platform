import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-random',
  name: 'Random Color Generator',
  category: 'color',
  summary: 'Generate random colors in a chosen style - warm, cool, pastel, vivid and more.',
  description:
    'Roll cryptographically random colors in hex, rgb() or hsl() form. Constrain the result to a style such as pastel, vivid, grayscale or earth tones using HSL ranges.',
  keywords: [
    'random color',
    'color generator',
    'random hex',
    'random palette',
    'pastel colors',
    'grayscale',
    'random hsl',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'count', label: 'How many colors', type: 'number', default: 8, min: 1, max: 48 },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'hex',
      choices: [
        { value: 'hex', label: 'HEX' },
        { value: 'rgb', label: 'rgb()' },
        { value: 'hsl', label: 'hsl()' },
      ],
    },
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'any',
      choices: [
        { value: 'any', label: 'Any' },
        { value: 'warm', label: 'Warm' },
        { value: 'cool', label: 'Cool' },
        { value: 'pastel', label: 'Pastel' },
        { value: 'vivid', label: 'Vivid' },
        { value: 'grayscale', label: 'Grayscale' },
        { value: 'earth', label: 'Earth tones' },
      ],
    },
  ],
  examples: [
    { title: 'Any colors', input: '' },
    { title: 'Pastels', input: '', options: { style: 'pastel', count: 6 } },
    { title: 'Grayscale as rgb()', input: '', options: { style: 'grayscale', format: 'rgb' } },
  ],
  faq: [
    {
      q: 'Are the colors truly random?',
      a: 'Yes - they come from the browser cryptographic random number generator (crypto.getRandomValues), not a seeded pseudo-random generator.',
    },
  ],
  related: [  "color-palette",
  "random-data",
  "color-blend"],
  status: 'stable',
};
