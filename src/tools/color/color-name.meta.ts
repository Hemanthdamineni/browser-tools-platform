import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-name',
  name: 'Color Name Finder',
  category: 'color',
  summary: 'Find the nearest of the 148 CSS named colors, ranked by perceptual distance.',
  description:
    'Enter any color and get the five closest CSS named colors. Distance is measured in CIE L*a*b* space, so near matches are perceptual rather than a raw RGB guess.',
  keywords: [
    'color name',
    'css color names',
    'nearest color',
    'named colors',
    'color to name',
    'css colors list',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'Exact name', input: '#7fffd4' },
    { title: 'Near a name', input: '#ee0000' },
    { title: 'From rgb()', input: 'rgb(100, 149, 237)' },
  ],
  article: [
    {
      heading: 'What you type and what you get back',
      body: 'Give the tool one colour in almost any CSS notation: a hex code with or without # in 3, 4, 6 or 8 digits, an rgb() or rgba() value, a hsl() or hsla() value, or a CSS colour name. It answers with the five nearest names out of the 148 CSS colours, ranked closest first with the name, its hex and the distance.',
    },
    {
      heading: 'Why the answer is perceptual, not just numeric',
      body: 'Your colour and each named colour are converted from sRGB into CIE L*a*b*, a space built to match how the eye judges similarity, and compared with the CIE76 Euclidean distance. That is why #ee0000 returns a near-red name rather than a colour with a coincidentally small raw RGB gap.',
    },
    {
      heading: 'Reading the distance column',
      body: 'Lower distance is closer. Below about 0.05 counts as an exact hit and the stats say so; anything in single digits is a name most people would accept as "the same colour"; larger numbers mean only the same family. The ranking makes the fall-off obvious when the best match is too specific.',
    },
    {
      heading: 'Limits, and where the lookup happens',
      body: 'Only red, green and blue are compared, so alpha in a 4- or 8-digit hex is ignored, and components are clamped to 0\u2013255. Saturation and lightness given as bare numbers above 1 are read as fractions rather than percentages. The palette is the CSS named set, so a brand colour is matched to a neighbour, never exactly. The whole lookup runs on your device with nothing sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'How is "nearest" measured?',
      a: 'Both colors are converted to CIE L*a*b* and compared with the CIE76 Euclidean distance. Lower distance means the colors look more alike.',
    },
    {
      q: 'Which input formats are accepted?',
      a: 'Hex with or without # in 3, 4, 6 or 8 digits, rgb() and rgba() with comma, space or slash separators (percentage components allowed), hsl() and hsla(), and any of the 148 CSS colour names. Anything else is rejected with an error rather than guessed at.',
    },
    {
      q: 'Why is a colour with an alpha channel matched without its transparency?',
      a: 'The comparison works on the red, green and blue channels. A 4- or 8-digit hex is accepted for convenience but its alpha is discarded, so a semi-transparent and an opaque version of the same colour give identical matches.',
    },
  ],
  related: ['color-convert', 'color-contrast', 'color-palette'],
  status: 'stable',
};
