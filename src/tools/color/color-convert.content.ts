/**
 * Editorial content for the color-convert tool page.
 *
 * Kept out of ``color-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
