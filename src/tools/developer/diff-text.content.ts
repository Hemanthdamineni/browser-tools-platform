/**
 * Editorial content for the diff-text tool page.
 *
 * Kept out of ``diff-text.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two texts, three comparison units',
      body: 'The workbench input is text A; text B goes in the “Text B” option box. Compare by lines, words or characters and the tool diffs at that granularity. The stats count added and removed units for whichever you chose — lines, words or characters.',
    },
    {
      heading: 'Unified or inline',
      body: 'Unified output produces a conventional diff with --- and +++ markers and @@ hunk headers, ready to paste into a patch. Inline output instead marks changed spans in place with [-removed-] and {+added+} wrappers, keeping the surrounding text intact — best when only a word or a character changed.',
    },
    {
      heading: 'Choosing a granularity',
      body: 'Line mode is the default and right for source, config and logs. Word mode isolates a changed identifier inside a long line. Character mode is the finest and useful for spotting a single mistyped digit, though on long inputs it is dense and harder to read.',
    },
    {
      heading: 'Empty and trailing-newline details',
      body: 'If text B is empty the tool treats it as an empty document, so every line of A shows as removed. Trailing newlines are normalised before a line diff, so a file differing only by a final newline does not report a spurious change. Whitespace inside a line is preserved, so indentation differences are real changes.',
    },
    {
      heading: 'Comparison stays on your device',
      body: 'Both texts are diffed inside this tab by a bundled library — no upload and no history. That matters when the two sides are a private key, a production config or a customer record.',
    },
  ],
  faq: [
    {
      q: 'How do I supply the second text?',
      a: 'The workbench input is text A. Put text B in the "Text B" option box. If B is left empty the tool treats it as an empty document.',
    },
    {
      q: 'What do the stats mean?',
      a: 'Additions and deletions count the changed units for the chosen granularity — added/removed lines, words, or characters.',
    },
    {
      q: 'Which view should I use?',
      a: 'Unified is best for line-level review and pasting into patches. Inline is best for spotting small word or character edits within a sentence.',
    },
  ],
} as const;
