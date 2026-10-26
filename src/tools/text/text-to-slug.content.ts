/**
 * Editorial content for the text-to-slug tool page.
 *
 * Kept out of ``text-to-slug.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What each option changes',
      body: 'Separator picks the joiner between words — hyphen, underscore or none. Lowercase output is on by default, and transliterate maps accented characters to ASCII so café becomes cafe, ñ becomes n, and the ligatures æ, œ, ß, ø, đ and ł each have their own mapping. Remove stopwords drops common words such as the, and, of and to.',
    },
    {
      heading: 'The normalising pipeline',
      body: 'Input is collapsed first: runs of whitespace become one space, both ends are trimmed, and anything over 20,000 characters is refused. The text is then transliterated, lowercased and stripped of every non-alphanumeric run in favour of the separator, with empty segments dropped. If nothing remains, the tool stops with a hint to toggle stopword removal or transliteration instead of returning a blank slug.',
    },
    {
      heading: 'Truncation stops at a word boundary',
      body: 'Max length does not slice mid-word. The slug is rebuilt one word at a time, stopping at the last whole word that fits, so a 60-character cap yields my-page-title rather than my-page-titl. With the none separator there are no word boundaries, so truncation falls back to a plain character cut.',
    },
    {
      heading: 'Deterministic and local',
      body: 'The transformation is a local string pipeline, so the text never leaves your browser and the page works offline. It is deterministic — the same input and options always produce the same slug — which suits filenames, repo names and anchor text.',
    },
  ],
  faq: [
    {
      q: 'What exactly is a slug?',
      a: 'The human-readable part of a URL that identifies a page, e.g. /tips/how-to-write-clean-code. A good slug is lowercase, uses one separator, and drops filler words.',
    },
    {
      q: 'Why transliterate accents?',
      a: 'URLs should stay ASCII. "café" becomes "cafe", "ñ" becomes "n", "æ" becomes "ae" — so links are copy-safe and consistent across systems.',
    },
    {
      q: 'What happens when max length cuts a word?',
      a: 'The slug is truncated at a word boundary and trailing separators are removed, so you never get a dangling "my-page-".',
    },
  ],
} as const;
