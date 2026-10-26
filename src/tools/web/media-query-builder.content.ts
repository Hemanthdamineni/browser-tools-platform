/**
 * Editorial content for the media-query-builder tool page.
 *
 * Kept out of ``media-query-builder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building a query from breakpoints',
      body: 'Build mode assembles @media clauses from an optional min-width, an optional max-width, and extra feature conditions, joined together with and. A feature must be a single parenthesized expression such as (hover: hover), and at least one width or feature condition is required before anything is emitted.',
    },
    {
      heading: 'Reading a pasted query',
      body: 'Analyze mode lists every feature condition with its validity, checks that parentheses balance and stay within a sensible depth, and flags queries that carry no feature at all or that omit a comparison operator and value.',
    },
    {
      heading: 'Known feature names',
      body: 'Width, height, aspect-ratio, orientation, resolution, pointer and hover are recognised, along with prefers-color-scheme, prefers-reduced-motion and friends. An unrecognised feature is marked for review rather than assumed valid.',
    },
    {
      heading: 'Mobile-first habit',
      body: 'min-width favours small screens first, letting breakpoints add on as the viewport grows, while max-width suits a desktop-first cascade. Either is fine, but pick one order and keep the project consistent.',
    },
    {
      heading: 'Parsed in the browser',
      body: 'Queries are analysed and composed entirely on-device. Nothing is sent anywhere and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'What makes a media query?',
      a: 'A media type (optional, default all) plus one or more feature conditions combined by and, or, or not.',
    },
    {
      q: 'Should I use min-width or max-width first?',
      a: 'Mobile-first CSS favors min-width so base styles apply to small screens and breakpoints add on. Desktop-first favors max-width.',
    },
    {
      q: 'Why balance parentheses?',
      a: 'Media queries nest feature expressions in parentheses; unbalanced parens make the whole rule invalid and the declaration block is dropped.',
    },
  ],
} as const;
