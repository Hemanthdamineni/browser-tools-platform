/**
 * Editorial content for the reverse-text tool page.
 *
 * Kept out of ``reverse-text.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What Reverse Text does',
      body: 'Flip a string character by character so the last letter comes first, or reverse the order of whole words, or reverse the order of whole lines. Words-in-line flips each line without moving the lines themselves. The result is plain text with no surrounding markup, ready to copy straight out.',
    },
    {
      heading: 'Checking a palindrome or a hidden message',
      body: 'It is the quick way to see whether a string reads the same backwards, and it is handy when text was deliberately written in reverse for a puzzle. Flipping the word order of a sentence also makes a set of bullet points read from the bottom up.',
    },
    {
      heading: 'The four modes',
      body: 'Characters reverses every code point end to end; word order swaps the position of the words while keeping each word readable; lines swaps whole lines; and words-in-line reverses the words inside each line without moving the lines. Each mode preserves the separators it is not reordering.',
    },
    {
      heading: 'What it does not touch',
      body: 'The tool performs a pure reversal and does not decode escapes, HTML entities or markdown. Characters built from several code points, such as some flags and family emoji, may split, and a poorly paired surrogate can display as a replacement glyph. Nothing is normalised or re-encoded.',
    },
    {
      heading: 'Your text stays in the browser',
      body: 'The reversal happens in the page and your text is never sent over the network. The tool works fully offline, so lines you are flipping for a label or a message stay on your own machine.',
    },
  ],
  faq: [
    {
      q: 'Why does character reverse not mangle emoji?',
      a: 'It splits on Unicode code points (Array.from), not UTF-16 units, so multi-byte characters stay intact. Some emoji built from several joined code points may still separate.',
    },
    {
      q: 'Does words mode keep the spacing readable?',
      a: 'Yes. Word order reverses the tokens but rejoins them with the exact whitespace that separated them, so runs of spaces and line breaks stay in place and the words themselves are never mirrored.',
    },
    {
      q: 'Which mode suits code or logs?',
      a: 'Line order is the useful one there: it flips the sequence of lines without rewriting their contents, so a stack trace can be read bottom-up. Reversing characters is only safe for display, not for anything you plan to run.',
    },
  ],
} as const;
