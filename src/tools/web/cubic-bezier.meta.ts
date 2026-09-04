import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cubic-bezier',
  name: 'Cubic Bezier Explorer',
  category: 'web',
  summary: 'Sample a cubic-bezier() easing curve and find the nearest CSS keyword.',
  description:
    'Enter x1, y1, x2, y2 to see the easing progress sampled over time, the exact cubic-bezier() string, and the closest standard keyword (ease, linear, ease-in, ease-out, ease-in-out).',
  keywords: [
    'cubic bezier',
    'css easing',
    'animation timing',
    'transition curve',
    'easing function',
    'ease-in-out',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'samples', label: 'Sample count', type: 'number', default: 11, min: 3, max: 25 },
  ],
  examples: [
    { title: 'ease', input: '0.25, 0.1, 0.25, 1' },
    { title: 'Custom snappy', input: '0.68, -0.55, 0.27, 1.55' },
  ],
  faq: [
    {
      q: 'Why can x be outside the table but y not?',
      a: 'Actually the reverse: CSS requires 0 ≤ x1,x2 ≤ 1 (they parametrise time), while y may overshoot to create bounce effects. Values outside that x range are rejected exactly like the browser would.',
    },
  ],
  related: ['gradient-css'],
  status: 'stable',
};
