import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-convert',
  name: 'Colour Converter',
  category: 'color',
  summary: 'Convert a colour between HEX, RGB, HSL, HSV, CMYK and OKLCH.',
  description:
    'Enter a colour in almost any CSS notation and get every other notation back, plus a WCAG contrast reading against black and white.',
  keywords: [
    'color',
    'colour',
    'hex',
    'rgb',
    'hsl',
    'hsv',
    'cmyk',
    'oklch',
    'converter',
    'contrast',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: '#3b82f6', input: '#3b82f6' },
    { title: 'rgb(239 68 68)', input: 'rgb(239 68 68)' },
    { title: 'hsl(160 84% 39%)', input: 'hsl(160 84% 39%)' },
  ],
  article: [
    {
      heading: 'One colour in, six notations out',
      body: 'Type a colour in almost any CSS form and the tool prints HEX, RGB, HSL, HSV, CMYK and OKLCH lines together. It reads three, four, six and eight digit hex with or without a leading hash, rgb() and rgba() with commas or spaces, hsl() and hsla(), and the CSS colour names it knows. Alpha survives the trip.',
    },
    {
      heading: 'Checking a shade for contrast',
      body: 'Each run also reports contrast against white and black plus relative luminance. A ratio of 4.5 or better is tagged AA, so settling body text on a brand background becomes a quick check rather than a separate audit.',
    },
    {
      heading: 'There is nothing to configure',
      body: 'This converter has no switches: everything is derived from the single value you paste, and the output is one line per notation. That makes it easy to lift just the format you need into a stylesheet or design token file.',
    },
    {
      heading: 'Where parsing stops',
      body: 'OKLCH is produced but not accepted on the way in, and the named colour list is the built-in set rather than the full CSS list. Hex strings of five or seven digits are rejected, and an unreadable value raises an error quoting the text that failed.',
    },
    {
      heading: 'Colour maths stays local',
      body: 'Every conversion happens in the page with plain arithmetic. The value you type is never transmitted, and the contrast figures are computed on your device rather than fetched from a service.',
    },
  ],
  faq: [
    {
      q: 'Which input formats are accepted?',
      a: '#rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces, hsl()/hsla(), and the 148 CSS named colours.',
    },
    {
      q: 'Is OKLCH accepted as input?',
      a: 'No. OKLCH is calculated as an output notation only; input must be hex, rgb(), hsl() or one of the built-in colour names.',
    },
    {
      q: 'How is the contrast ratio shown?',
      a: 'Contrast against pure white and pure black is printed with two decimals and a ratio of 4.5:1 or higher is marked AA. Relative luminance is reported separately.',
    },
  ],
  related: ['color-contrast', 'color-palette', 'color-blend'],
  status: 'stable',
};
