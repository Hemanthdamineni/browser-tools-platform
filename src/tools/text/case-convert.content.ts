/**
 * Editorial content for the case-convert tool page.
 *
 * Kept out of ``case-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The fourteen targets',
      body: 'The Convert to selector exposes fourteen targets in two families. Word-recombining styles — camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case, dot.case and path/case — split the input into words and rejoin them. Whole-text styles — UPPER, lower, Title, Sentence, Capitalise Each Word, aLtErNaTiNg and iNVERSE — transform the string as given. Title and Sentence preserve your whitespace rather than rebuilding it.',
    },
    {
      heading: 'How identifiers are split into words',
      body: 'The word-recombining styles detect boundaries rather than relying on spaces. They split on hyphens, underscores, dots and slashes, and also at every lowercase-to-uppercase transition and at acronym boundaries, so MyHTTPComponent becomes My + HTTP + Component instead of one lump. Whole-text styles skip that splitting entirely.',
    },
    {
      heading: 'Inverse and alternating work character by character',
      body: 'iNVERSE swaps the case of every character individually, so an accidental All Caps paste can be flipped back. aLtErNaTiNg walks the string and flips case every other alphabetic character, leaving non-letters untouched. Both act on the given characters and ignore word structure, which is what makes them useful for undoing a bad paste rather than for styling prose.',
    },
    {
      heading: 'Nothing is stored or sent',
      body: 'The conversion is a pure string operation in this tab, so the text never leaves your browser and no network connection is needed. Nothing is logged, and no state carries between runs.',
    },
  ],
  faq: [
    {
      q: 'How are words detected inside an identifier?',
      a: 'Runs are split on spaces, hyphens, underscores, dots and slashes, and also at lowercase→uppercase transitions and acronym boundaries (e.g. "HTTPServer" → "HTTP" + "Server").',
    },
    {
      q: 'Why does Title Case not touch my camelCase?',
      a: 'Title Case is whitespace-preserving and works on whole words, so it capitalises each space-separated word without splitting identifiers. To re-case an identifier, use camel, snake, kebab or one of the other word-recombining targets instead.',
    },
    {
      q: 'What is the difference between Title and Capitalise Each Word?',
      a: 'Title lowercases the rest of each word (hELLO → Hello) and preserves spaces, while Capitalise Each Word only uppercases the first letter and leaves the remainder untouched.',
    },
  ],
} as const;
