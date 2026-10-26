/**
 * Editorial content for the text-similarity tool page.
 *
 * Kept out of ``text-similarity.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Scoring lines against a reference',
      body: 'Paste any number of lines and each one is compared to a reference, which defaults to the first line unless you fill in the reference field. Every row reports the edit distance, a similarity percentage, and how many characters the start and end share. Choosing lines instead of table output gives compact score d= distance rows.',
    },
    {
      heading: 'Picking the right metric',
      body: 'Levenshtein counts insertions, deletions and substitutions. Damerau-Levenshtein also treats one adjacent swap as a single edit, so teh and the stay close together. Jaro-Winkler returns a score from 0 to 1 that rewards a shared opening, which suits matching personal names and records.',
    },
    {
      heading: 'Options that change the ranking',
      body: 'Case sensitive is off by default and trim whitespace removes blank lines before comparison. Sort results orders either closest first or in the original input order, and max rows caps the table at 200 lines by default, adjustable up to 5000.',
    },
    {
      heading: 'Size ceilings and code points',
      body: 'Input is limited to 200000 characters and 5000 lines. The distance metrics fill a quadratic table, so long pairs are refused once the longer string approaches 2000 characters. Text is compared by code point, so an emoji counts as one unit rather than two.',
    },
    {
      heading: 'Comparison stays in the browser',
      body: 'Everything runs on the text you type, locally. No line is uploaded, no request leaves the page, and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'What is edit distance?',
      a: 'The number of single-character insertions, deletions or substitutions needed to turn one string into the other. A distance of 0 means the strings are identical.',
    },
    {
      q: 'Which metric should I use?',
      a: 'Levenshtein for typos, Damerau-Levenshtein when a swapped pair such as "teh" versus "the" should count as one edit instead of two, and Jaro-Winkler when matching names or records where a shared prefix is a strong signal.',
    },
    {
      q: 'How is the similarity percentage calculated?',
      a: 'For the two distance metrics it is 1 minus distance divided by the length of the longer string, as a percentage. Jaro-Winkler produces its own score between 0 and 1, so no separate distance is shown.',
    },
    {
      q: 'Does it count emoji as one character?',
      a: 'Yes. Text is compared code point by code point, so an astral character such as an emoji counts as a single unit rather than two UTF-16 code units.',
    },
  ],
} as const;
