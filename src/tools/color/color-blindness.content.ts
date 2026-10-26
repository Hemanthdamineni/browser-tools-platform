/**
 * Editorial content for the color-blindness tool page.
 *
 * Kept out of ``color-blindness.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Simulated colours, one per line',
      body: 'Type one colour per line — hex (#3b82f6), rgb()/rgba(), hsl()/hsla(), or any of the 148 CSS colour names — and each line is parsed to sRGB, run through the simulation matrix, and returned as a hex code rendered as a swatch. The originals are repeated in the notes.',
    },
    {
      heading: 'A check to run before shipping a chart',
      body: 'Run your palette through it before publishing a chart, a status badge or a red/green pass-or-fail indicator. If deuteranopia collapses your green and red into the same murky brown, a colour-only signal will fail for a large slice of your audience.',
    },
    {
      heading: 'Deficiency type and severity',
      body: 'The Deficiency menu selects the matrix: protanopia (no red), deuteranopia (no green), tritanopia (no blue) or achromatopsia (no colour at all). Severity blends the result back toward the original, from 100% for a full deficiency down to 0% for none.',
    },
    {
      heading: 'It is an engineering approximation',
      body: 'The maths applies the linear-RGB Viénot/Brettel matrices widely used for colour-vision-deficiency simulation, not a clinical model of an individual eye. Treat the swatches as a warning that a palette is risky, then confirm with a contrast measurement.',
    },
    {
      heading: 'Parsed and simulated locally',
      body: 'Colour parsing and the matrix arithmetic run entirely in this tab; your palette is never sent anywhere and the page works offline. That matters when the colours come from an unreleased brand or a private design system.',
    },
  ],
  faq: [
    {
      q: 'Which simulation is this?',
      a: 'The linear-RGB Viénot/Brettel 3x3 matrices commonly used for CVD simulation, blended with the original color by the severity setting. They are an approximation, not a clinical model.',
    },
    {
      q: 'Can I simulate a whole palette?',
      a: 'Enter one color per line - each line is simulated in order.',
    },
    {
      q: 'What does the severity slider do?',
      a: 'It blends the fully-simulated color back toward the original. At 100% you see a total deficiency; at lower values you see the milder appearance someone with a partial deficiency would get, which is closer to what most people actually experience.',
    },
    {
      q: 'Which input formats are accepted?',
      a: 'Hex values with or without a #, rgb() and rgba() tuples, hsl() and hsla() tuples, and the 148 CSS named colors such as tomato, rebeccapurple and linen. Anything else is reported as not a color.',
    },
  ],
} as const;
