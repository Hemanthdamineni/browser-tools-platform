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
  article: [
    {
      heading: 'Sampling a timing function',
      body: 'Enter four numbers — x1, y1, x2, y2 — and the tool returns a table of t against eased progress, sampled evenly across the animation. The stats show the exact CSS string to paste, cubic-bezier(x1, y1, x2, y2), and the standard keyword whose control points are closest to yours: ease, linear, ease-in, ease-out or ease-in-out.',
    },
    {
      heading: 'Tuning an animation before you ship it',
      body: 'Use it to see what a curve actually does before committing it to a stylesheet: how quickly it accelerates, whether it eases into the end, and whether a bounce overshoots as much as you imagined. The nearest-keyword row is a quick hint that a stock keyword would have been close enough.',
    },
    {
      heading: 'The one option',
      body: 'Sample count (3–25, default 11) controls how many rows the table has. A small number gives a quick feel for the curve; a larger one reveals its shape near the ends, where the difference between similar easings is easiest to see.',
    },
    {
      heading: 'Rules and caveats',
      body: 'CSS constrains x1 and x2 to between 0 and 1 because they parametrise time, while y1 and y2 may leave that range to produce overshoot and bounce — out-of-range x values are rejected exactly as a browser would. The input must be four finite numbers separated by spaces or commas, and the keyword match is a plain distance between control points.',
    },
    {
      heading: 'Curve maths in your browser',
      body: 'The Bézier evaluation and the Newton solve both run locally and the numbers you type are never sent anywhere. It works offline, so you can tune a curve mid-flight.',
    },
  ],
  examples: [
    { title: 'ease', input: '0.25, 0.1, 0.25, 1' },
    { title: 'Custom snappy', input: '0.68, -0.55, 0.27, 1.55' },
    {
      title: 'Overshoot, finely sampled',
      input: '0.34, 1.56, 0.64, 1',
      options: { samples: 21 },
    },
  ],
  faq: [
    {
      q: 'Why can x be outside the table but y not?',
      a: 'Actually the reverse: CSS requires 0 ≤ x1,x2 ≤ 1 (they parametrise time), while y may overshoot to create bounce effects. Values outside that x range are rejected exactly like the browser would.',
    },
    {
      q: 'What does the "nearest keyword" row mean?',
      a: 'It compares your four control points with the control points of ease, linear, ease-in, ease-out and ease-in-out and names the closest by straight-line distance in that four-dimensional space. It is a convenience hint, not a claim that the keyword is equivalent.',
    },
    {
      q: 'Can y values go outside the 0 to 1 range?',
      a: 'Yes. Only x1 and x2 are constrained by CSS because they stand for time; y1 and y2 may overshoot, which is how cubic-bezier produces bounce and anticipation. The tool permits it and the sample table shows the overshoot plainly.',
    },
  ],
  related: ['gradient-css'],
  status: 'stable',
};
