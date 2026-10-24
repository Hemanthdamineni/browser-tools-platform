import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'reverse-text',
  name: 'Reverse Text',
  category: 'text',
  summary: 'Reverse text by character, word, sentence or line — emoji-safe.',
  description:
    'Flip a string end to end, or reverse the order of its words or lines while keeping each one readable. Splitting is done on Unicode code points so emoji and combined characters are not broken.',
  keywords: ['reverse', 'backwards', 'mirror text', 'flip', 'reverse words'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'by',
      label: 'Reverse',
      type: 'select',
      default: 'characters',
      choices: [
        { value: 'characters', label: 'Characters' },
        { value: 'words', label: 'Word order' },
        { value: 'lines', label: 'Line order' },
        { value: 'words-in-line', label: 'Words within each line' },
      ],
    },
  ],
  examples: [
    { title: 'Characters', input: 'Hello 👋 World' },
    { title: 'Word order', input: 'the quick brown fox', options: { by: 'words' } },
    { title: 'Lines in reverse', input: 'first\nsecond\nthird', options: { by: 'lines' } },
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
  related: ['sort-lines', 'case-convert', 'rot13'],
  status: 'stable',
};
