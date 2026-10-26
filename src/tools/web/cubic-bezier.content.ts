/**
 * Editorial content for the cubic-bezier tool page.
 *
 * Kept out of ``cubic-bezier.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
