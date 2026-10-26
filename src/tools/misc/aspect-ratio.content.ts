/**
 * Editorial content for the aspect-ratio tool page.
 *
 * Kept out of ``aspect-ratio.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Three ways to work with a ratio',
      body: 'The Mode selector chooses what you want done. Solve a dimension takes a ratio plus one known width or height and returns the other side. Simplify a ratio reduces two numbers to their lowest whole form and names the nearest common ratio such as 16:9. Presets lists common resolutions grouped by their ratio family.',
    },
    {
      heading: 'Why both numbers are reduced',
      body: 'Simplify divides both ratio components by their greatest common divisor, so 1920:1080 becomes 16:9. The decimal value is computed alongside and used to pick the closest named ratio within a small tolerance, which is how a slightly unusual resolution still gets a helpful label.',
    },
    {
      heading: 'Solving uses the cross product',
      body: 'In solve mode the tool applies the ratio as a fraction and scales the known side, so width 1280 at 16:9 gives height 720. Exactly one known dimension is allowed, and the result is reported to two decimal places for values that do not come out whole.',
    },
    {
      heading: 'All arithmetic happens locally',
      body: 'Ratios, resolutions and the preset table are plain numbers held in the page. No value is sent to a server and no network connection is made, so the calculation is instant and the numbers never leave your browser.',
    },
  ],
  faq: [
    {
      q: 'How do I solve for a missing width or height?',
      a: 'Pick Solve a dimension, enter the ratio (for example 16 and 9) and supply exactly one known side — the width or the height. The tool computes the other dimension to two decimal places.',
    },
    {
      q: 'What does "nearest common ratio" mean?',
      a: 'It compares the simplified ratio’s decimal value against a small set of familiar ratios (16:9, 4:3, 21:9, 1:1, 3:2 and others) and labels the closest match, so an unusual resolution is easier to recognise.',
    },
    {
      q: 'Can I enter a ratio like 2.39:1?',
      a: 'Yes. The ratio fields accept decimals and the simplifier rounds them to integers before reducing, which is how CinemaScope (2.39:1) appears in the presets. Decimal input is fine in both solve and simplify modes.',
    },
  ],
} as const;
