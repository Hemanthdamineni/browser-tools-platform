/**
 * Editorial content for the svg-optimizer tool page.
 *
 * Kept out of ``svg-optimizer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What minify and pretty really change',
      body: 'Minify collapses whitespace between tags and emits the whole document on one line; pretty reindents it at two spaces per level. Neither reorders attributes nor rewrites path data — the difference is serialization only, and the reported before/after size shows exactly what the whitespace removal saved you.',
    },
    {
      heading: 'Rounding numbers without touching colours',
      body: '“Decimal precision” rounds standalone numeric tokens inside attribute values — coordinates in d, x, y, width, plus transform matrices — to between 0 and 6 decimals. Hex colours such as #fff, rgb() triples, identifiers and unit-suffixed values are recognised and skipped, so geometry tidies up without a fill silently shifting.',
    },
    {
      heading: 'Comments and empty groups',
      body: '“Remove comments” deletes XML comments, the annotations vector editors leave behind, while “Remove empty <g> elements” strips groups with no drawable children. Groups carrying attributes or real content are kept, so structure that affects rendering survives the pass intact.',
    },
    {
      heading: 'Loud failure on broken input',
      body: 'If the opening <svg> element is missing or the tags are unbalanced the optimizer reports an error instead of emitting a broken file, and anything beyond two million characters is refused. Parsing and re-serialization both happen in the browser, so the artwork you paste is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'Does it change how the SVG looks?',
      a: 'No. Only the serialization changes: whitespace between tags, comments (when enabled), empty <g> groups and numeric precision. Colours, paths and attribute values keep their meaning. "none" fills and stroke remain untouched.',
    },
    {
      q: 'What does rounding do to attributes?',
      a: 'Numeric tokens in attribute values (geometry, transform matrices that are present, coordinates) are rounded to the chosen precision. Colour values (hex like #fff or rgb(...)), identifiers and unit suffixes are left alone.',
    },
    {
      q: 'Is minified output safe to inline in HTML?',
      a: 'Yes — a single-line SVG is generally the most bandwidth-friendly for inlining. If any browser parser has issues with your exact file you can switch to pretty mode for a readable diff first.',
    },
    {
      q: 'Does it handle malformed SVG?',
      a: 'It reports a clear error if the opening <svg> element is missing or tags are unbalanced, rather than emitting a broken document.',
    },
  ],
} as const;
