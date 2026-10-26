/**
 * Editorial content for the css-minifier tool page.
 *
 * Kept out of ``css-minifier.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the CSS Minifier removes',
      body: 'Paste a stylesheet and the tool strips comments, collapses runs of whitespace, trims space around selectors, braces and declaration separators, drops the final semicolon in each block, and deletes rules that end up empty. The result is the same CSS with fewer bytes, and the report tells you how much smaller it got.',
    },
    {
      heading: 'Trimming a stylesheet for shipping',
      body: 'Use it on hand-written or exported CSS just before you paste it into a template or inline it in a style element. Because the transformation only touches whitespace and comments, the styling is byte-for-byte equivalent, so you can minify a production rule set without a build step or a risk of changed behaviour.',
    },
    {
      heading: 'The two switches',
      body: 'Keep license comments leaves the /*! banner comments that tools and licences use, and turning it off strips those as well. Remove empty rules deletes blocks with nothing inside after minifying; switch it off if you keep them as deliberate placeholders.',
    },
    {
      heading: 'What is deliberately left alone',
      body: 'It never renames selectors, merges rules or rewrites values, so the output stays predictable. Spaces are preserved inside strings and url() contents, between two identifiers, and around plus and minus inside calc and the other maths functions where CSS requires them. Inputs beyond two megabytes are rejected.',
    },
    {
      heading: 'Your stylesheet is not uploaded',
      body: 'Minification happens in the page. Nothing is sent anywhere and the tool works offline, so a stylesheet that names internal components or carries licence text stays on your machine.',
    },
  ],
  faq: [
    {
      q: 'Will the minified CSS still be valid?',
      a: 'Yes. Whitespace is only removed where CSS allows it: never inside strings or url() contents, never between two identifiers, and always kept around + and - inside calc(), min(), max() and clamp(), where CSS requires it.',
    },
    {
      q: 'What happens to comments?',
      a: 'Normal comments are removed. Comments that start with /*! — the convention for licenses and banners — are kept by default; turn off "Keep /*! license comments" to drop them too.',
    },
    {
      q: 'Are empty rules really removed?',
      a: 'Yes, rules whose body is empty after minification are deleted, including nested ones and empty at-rule blocks. Disable "Remove empty rules" if you rely on them as placeholders.',
    },
    {
      q: 'Does it rename or merge selectors?',
      a: 'No. It is a safe, lossless whitespace and comment minifier: selectors, properties, values and their order are left exactly as written.',
    },
  ],
} as const;
