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
  faq: [
    {
      q: 'Which input formats are accepted?',
      a: '#rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces, hsl()/hsla(), and the 148 CSS named colours.',
    },
  ],
  related: ['color-contrast', 'color-palette', 'gradient-generator'],
  status: 'stable',
};
