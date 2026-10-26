/**
 * Editorial content for the slugify tool page.
 *
 * Kept out of ``slugify.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a title to a URL segment',
      body: 'A slug is the short, readable piece of a URL that stands in for a title, and this tool converts one to the other in a single pass. Text is lowercased by default, punctuation and symbols are dropped, runs of spaces become a single separator, and accents are folded to their plain ASCII letters, so "My Great Post: Part 2!" returns "my-great-post-part-2".',
    },
    {
      heading: 'Choosing the separator and case',
      body: 'Hyphens are the default because search engines and readers both handle them well, but underscores, dots and the empty separator are available for platforms that expect them. The lowercase toggle is separate, so a case-sensitive route can keep the original capitalisation while still having its spaces tidied into the chosen separator.',
    },
    {
      heading: 'Strict mode and non-Latin scripts',
      body: 'Strict mode keeps only ASCII and deletes everything else, which is the safe choice for most public URLs. Turning it off lets letters from Cyrillic, Greek and CJK scripts survive, which suits localised sites that serve Unicode paths. Either way an optional maximum length trims the result at a word boundary where possible.',
    },
    {
      heading: 'Nothing is uploaded',
      body: 'The whole conversion is a plain string operation that runs in this browser tab. There is no server call, no logging and no state kept between runs, so unpublished titles and draft route names never leave your machine.',
    },
  ],
  faq: [
    {
      q: 'What happens to non-Latin scripts?',
      a: 'In strict mode they are removed. Turn strict off to keep letters from other scripts (Cyrillic, Greek, CJK) — useful for localised URLs on sites that allow Unicode paths.',
    },
    {
      q: 'Why did two words collapse into one?',
      a: 'Symbols and punctuation are removed rather than replaced, so a title like "rock & roll" becomes "rock-roll" because the ampersand disappears and the surrounding spaces bracket the gap. Rewriting the title with a real word avoids the missing separator.',
    },
    {
      q: 'Does the maximum length cut mid-word?',
      a: 'It trims the result to the limit you set and then drops a trailing separator left behind by the cut. It does not look ahead for a word boundary, so check the tail of a long title before publishing it.',
    },
  ],
} as const;
