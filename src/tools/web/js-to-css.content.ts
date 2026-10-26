/**
 * Editorial content for the js-to-css tool page.
 *
 * Kept out of ``js-to-css.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the converter emits',
      body: 'JS Object to CSS turns a React-style style object, or an equivalent JSON object, back into CSS. camelCase keys become kebab-case, a leading capital like WebkitTransform becomes a -webkit- prefix, quoted values are unquoted, and content values are re-quoted. A bare object becomes a declaration list and a nested object becomes rules.',
    },
    {
      heading: 'When to leave CSS-in-JS behind',
      body: 'Reach for it when moving styles out of a component into a stylesheet, or when you have a JSON style blob from a design tool or an API and need readable CSS. It is the reverse of css-to-js, so it also helps check that a round trip lost nothing.',
    },
    {
      heading: 'The px toggle and key casing',
      body: 'The pxForNumbers toggle decides what happens to bare numbers. On, a number on a length property such as width or font-size gains px, while unitless properties like opacity, z-index, line-height and font-weight stay bare and 0 is never given a unit. Off, every number is emitted as written.',
    },
    {
      heading: 'Values the converter drops',
      body: 'Booleans, null, undefined and empty values are dropped, since CSS has no equivalent for React truthiness. Input is capped at 200,000 characters and must be a balanced object literal; a missing brace or a malformed entry is reported rather than guessed at, and if every entry was nested or dropped there is nothing to convert.',
    },
    {
      heading: 'Where the object is parsed',
      body: 'The conversion runs in your browser only. Your style object is parsed and rendered on the device, never uploaded, and the tool makes no network requests.',
    },
  ],
  faq: [
    {
      q: 'Which properties get px?',
      a: 'Bare numbers on properties that accept lengths (width, margin, font-size…) become px. Numeric props like opacity, z-index, line-height, flex-grow and font-weight stay bare because CSS treats them as unitless.',
    },
    {
      q: 'How are booleans and null handled?',
      a: 'They are dropped — React uses truthiness to disable some properties (e.g. display: false), and CSS has no equivalent.',
    },
    {
      q: 'Can I convert a whole style tree?',
      a: 'Yes. A nested object becomes rules: { "@media (max-width: 600px)": { … } } or per-selector keys work the same way as css-to-js.',
    },
  ],
} as const;
