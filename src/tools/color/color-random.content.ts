/**
 * Editorial content for the color-random tool page.
 *
 * Kept out of ``color-random.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
