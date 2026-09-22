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
  faq: [
    {
      q: 'How is "nearest" measured?',
      a: 'Both colors are converted to CIE L*a*b* and compared with the CIE76 Euclidean distance. Lower distance means the colors look more alike.',
    },
  ],
  related: ['color-convert', 'color-contrast', 'color-palette'],
  status: 'stable',
};
