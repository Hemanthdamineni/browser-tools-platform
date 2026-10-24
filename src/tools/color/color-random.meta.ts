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
  article: [
    {
      heading: 'Random colors straight from the browser CSPRNG',
      body: 'Each color starts as a random hue, saturation and lightness drawn with crypto.getRandomValues, then converted to the output format. Ask for 1 to 48 colors and they appear as a swatch strip plus a plain list. Formats are #rrggbb hex, rgb(r, g, b) and hsl(h, s%, l%).',
    },
    {
      heading: 'When a random palette helps',
      body: 'Use it to break out of the same three colors you always reach for: roll a set for a chart series, a user avatar, a placeholder while a design is undecided, or a starting point for a brand exploration. Grayscale rolls are handy for testing a layout where color should not carry meaning.',
    },
    {
      heading: 'What the style ranges constrain',
      body: 'Warm limits the hue to 0–60 or 300–360 degrees; cool uses 180–300. Pastel keeps lightness high around 80–92% with low saturation, vivid pushes saturation to 80–100%, earth stays in a muted 20–45 degree band, and grayscale drops saturation to zero so lightness alone varies.',
    },
    {
      heading: 'No seeds, no contrast checks',
      body: 'There is no seed, so a run cannot be replayed exactly and two runs will differ. The styles constrain hue, saturation and lightness only; they promise nothing about contrast against a background, so check WCAG ratios yourself. The text box on the page is not read by the generator; the count, format and style options decide the result.',
    },
    {
      heading: 'Generated locally',
      body: 'Randomness comes from the browser cryptographic generator and the conversion runs in this tab, so no palette is requested from a server and nothing you do here is uploaded or logged.',
    },
  ],
  faq: [
    {
      q: 'Are the colors truly random?',
      a: 'Yes - they come from the browser cryptographic random number generator (crypto.getRandomValues), not a seeded pseudo-random generator.',
    },
    {
      q: 'Can I reproduce the same sequence later?',
      a: 'No. Every value is drawn fresh from the browser cryptographic generator, so there is no seed to set and a second run gives different colors. Copy the output if you need a fixed list.',
    },
    {
      q: 'Do the styles guarantee readable contrast?',
      a: 'No. Warm, cool, pastel, vivid, earth and grayscale only constrain hue, saturation and lightness ranges; they say nothing about contrast against a particular background, so check WCAG contrast when pairing text with a generated color.',
    },
  ],
  related: ['color-palette', 'random-data', 'color-blend'],
  status: 'stable',
};
