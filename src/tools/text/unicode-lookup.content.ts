/**
 * Editorial content for the unicode-lookup tool page.
 *
 * Kept out of ``unicode-lookup.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Unicode Code Point Explorer shows',
      body: 'It splits your text into characters and, for each one, reports the code point as U plus hex, its decimal value, the Unicode plane it lives in, and the exact UTF-8 and UTF-16 byte sequences. A table layout is the default; the lines format prints the same data as one compact record per character.',
    },
    {
      heading: 'When to reach for the code point view',
      body: 'Use it when a string comes back as garbage after a round trip through a database or an old file, when an emoji behaves oddly in code, or when you need to prove which bytes a character really occupies. Control characters are drawn with visible stand-ins so no row comes out blank.',
    },
    {
      heading: 'Caps and flags to watch for',
      body: 'Max characters caps the rows shown at 500 by default and 5,000 at most, and input beyond 100,000 characters is refused outright. Code points above U plus FFFF are labelled astral and flagged as using a UTF-16 surrogate pair, and the tool warns if the text contains Unicode noncharacters that are not safe for interchange.',
    },
    {
      heading: 'Inspection that stays local',
      body: 'The whole breakdown happens in your browser; the string you paste is never uploaded, and the page works offline.',
    },
  ],
  faq: [
    {
      q: 'What is a code point?',
      a: 'Each character in Unicode has a numeric code point, usually written U+ followed by hex, e.g. U+1F44D for the thumbs-up emoji.',
    },
    {
      q: 'Which characters count as astral?',
      a: 'Code points above U+FFFF live outside the Basic Multilingual Plane and are encoded in UTF-16 as a surrogate pair of two 16-bit units.',
    },
    {
      q: 'Why does the UTF-8 column matter?',
      a: 'Mojibake happens when bytes encoded in one UTF flavour are decoded as another. The UTF-8 column shows exactly how many bytes each character requires (1-4).',
    },
  ],
} as const;
