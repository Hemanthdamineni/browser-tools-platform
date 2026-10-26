/**
 * Editorial content for the color-palette tool page.
 *
 * Kept out of ``color-palette.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Input and output',
      body: 'Type a single base colour and the tool returns a row of clickable swatches, with the underlying value as a JSON array of hex strings. The base can be a 3- or 6-digit hex code with or without the hash, an rgb() or rgba() function, or one of about thirty CSS colour names such as teal or crimson.',
    },
    {
      heading: 'Choosing a scheme',
      body: 'Tints & shades keeps hue and saturation and sweeps lightness from 10% to 95%, the fastest way to build a scale for a design system. Monochromatic varies saturation and lightness around the base for a subtler set. Analogous rotates the hue ±30°, and complementary, triadic, tetradic and split-complementary jump to fixed offsets of 180°, 120°, 90°/270° and 150°/210°.',
    },
    {
      heading: 'What the count option actually does',
      body: 'For tints & shades, monochromatic and analogous the count sets how many swatches you get, clamped to 3–12. The geometric schemes have a fixed size by definition — complementary 2, triadic 3, tetradic 4, split-complementary 3 — so changing count does nothing there.',
    },
    {
      heading: 'Limits and edge cases',
      body: 'Conversion goes through HSL, so a swatch can land a shade or two from what a native colour picker would give. Alpha is parsed but not carried through: an rgba() value contributes only its red, green and blue channels, and every result is an opaque six-digit hex.',
    },
    {
      heading: 'Computed in the browser',
      body: 'Colour maths runs locally in this tab — there is no colour service and no request. Your brand colours are not sent anywhere, which matters when the palette is for an unreleased product.',
    },
  ],
  faq: [
    {
      q: 'How many colors do the geometric schemes produce?',
      a: 'Complementary yields 2, triadic 3, tetradic 4, split-complementary 3 - the count option is ignored for those. Tints & shades, monochromatic and analogous fill/repeat to the chosen count.',
    },
    {
      q: 'Which input formats are accepted?',
      a: 'A 3- or 6-digit hex code with or without the leading hash, an rgb() or rgba() function, or a CSS colour name from a built-in list of about thirty (black, white, red, teal, crimson and so on).',
    },
    {
      q: 'Can I export the palette as CSS variables?',
      a: 'The output is a plain JSON array of hex strings, so you can copy it straight into a build script or paste it into another tool. Nothing is styled for you — the array is the raw data behind the swatches.',
    },
  ],
} as const;
