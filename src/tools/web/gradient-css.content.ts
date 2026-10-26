/**
 * Editorial content for the gradient-css tool page.
 *
 * Kept out of ``gradient-css.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the generator writes out',
      body: 'List your colour stops and the tool returns a ready-to-paste rule: a background-image declaring a linear, radial or conic gradient, preceded by a background-color line. Stops are entered one per line, and at least two are required — a single stop is not a gradient and is rejected. The output is plain CSS text with no wrapper and no preview styling, so it drops straight into a stylesheet or a style attribute, and the first stop’s colour is reused as the solid fallback underneath.',
    },
    {
      heading: 'The three gradient functions',
      body: 'A linear gradient takes an angle, with 0deg pointing to the top of the element and 90deg to the right, and the browser interpolates along that direction. A radial gradient takes a shape — ellipse, the default, or circle — and radiates outward from the centre. A conic gradient sweeps around the centre starting at a rotation, which is how you build colour wheels and pie-style fills. The chosen type decides which of the extra settings apply: the angle for linear and the start of the sweep for conic, the shape for radial.',
    },
    {
      heading: 'Stop syntax, colours and validation',
      body: 'Each line is read as a colour followed optionally by a position: the first whitespace-separated token is the colour and the rest of the line is passed through unchanged, so percentages, pixel offsets and angle units all survive into the output. A colour may be a 3-, 4-, 6- or 8-digit hex value, an rgb(), rgba(), hsl() or hsla() function, or one of the common keywords such as transparent and currentColor. If the first token is not recognisable as a colour the whole run stops with an error naming it, which keeps an obvious typo out of your stylesheet.',
    },
    {
      heading: 'Why the fallback line, and where it runs',
      body: 'The background-color line exists for the browsers and email clients that cannot parse a gradient: they ignore the background-image and paint the flat first-stop colour instead. Beyond that validation, CSS legality is the browser’s business — the tool makes no attempt to render or preview anything, so it stays a fast, dependency-free string builder. The whole thing runs locally in your browser with no upload, so a brand palette you are experimenting with stays private.',
    },
  ],
  faq: [
    {
      q: 'What is the background-color line for?',
      a: 'Browsers that fail to parse the gradient (very old engines) still get a solid fill of the first stop colour. It is the standard progressive-enhancement pattern.',
    },
    {
      q: 'How is each stop line interpreted?',
      a: 'The first whitespace-separated token must be a colour and everything after it is kept verbatim as the position, so red 20%, #38bdf8 0% and blue 25% all work. The first token is checked against hex (3, 4, 6 or 8 digits), rgb()/rgba()/hsl()/hsla() and a list of common colour keywords; anything else is rejected with the offending token named.',
    },
    {
      q: 'What does the angle do for each gradient type?',
      a: 'For a linear gradient it sets the direction, where 0deg points to the top and 90deg to the right. For a conic gradient it becomes the from rotation that the sweep starts at. A radial gradient takes a shape instead, so its syntax is radial-gradient(circle, …) or radial-gradient(ellipse, …) with no angle.',
    },
  ],
} as const;
