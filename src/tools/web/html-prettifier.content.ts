/**
 * Editorial content for the html-prettifier tool page.
 *
 * Kept out of ``html-prettifier.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Reindenting markup without rewriting it',
      body: 'Paste a chunk of HTML and the prettifier tokenizes it, builds a tree and re-emits it with one tag per line at the indent you pick. Tag names, attribute order, quoted values and character references are copied verbatim; only the whitespace between tokens is rewritten. Short inline runs that fit stay together on one line, while an opening tag longer than the wrap threshold has its attributes split one per line.',
    },
    {
      heading: 'Regions it deliberately leaves alone',
      body: 'Content inside pre, textarea, script, style and xmp is copied exactly, because reindenting it would change what the page actually renders. XML comments keep their original indentation unless you switch on “Re-indent comments”, which is off by default for the same reason.',
    },
    {
      heading: 'Choosing indent width and wrap point',
      body: '“Indent width (spaces)” takes 0–8, and “Use tabs for indent” replaces the indent unit entirely; an indent of 0 gives flush-left tags with line breaks but no nesting. “Max width before attributes wrap”, from 40 to 200 columns, decides when a long opening tag is unbundled vertically onto its own attribute lines.',
    },
    {
      heading: 'Malformed markup fails softly',
      body: 'This is a formatter rather than a validating parser: unclosed tags, stray brackets and unknown elements are normalized conservatively and never throw, and input beyond two million characters is refused. Nothing is sent anywhere, so production HTML you would not hand to an online service still stays on your device.',
    },
  ],
  faq: [
    {
      q: 'Is the output semantically identical to the input?',
      a: 'Yes. The formatter only changes whitespace between tokens (and never inside a <pre> element). Tag names, attributes, quoted values, comments and character references are copied as-is.',
    },
    {
      q: 'Can it parse HTML perfectly?',
      a: 'No parser handles every malformed document. Unknown tags, unmatched brackets and weird inline content are normalized conservatively; the formatter is designed to fail gracefully and never throw for malformed markup.',
    },
    {
      q: 'Does it minify?',
      a: 'No, it does the opposite. There is nothing removed and no attribute reordered. Use it to make inline messy markup human-readable again.',
    },
  ],
} as const;
