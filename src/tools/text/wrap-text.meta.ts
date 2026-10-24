import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'wrap-text',
  name: 'Wrap / Unwrap Text',
  category: 'text',
  summary:
    'Hard-wrap text to a fixed column width with greedy word wrap, or unwrap wrapped lines back into paragraphs.',
  description:
    'Reflow prose to a chosen line width, or collapse already-wrapped lines back into single lines per paragraph. Blank lines between paragraphs are preserved by default.',
  keywords: [
    'wrap text',
    'word wrap',
    'unwrap text',
    'line wrap',
    'hard wrap',
    'reflow text',
    'text wrapping',
    'column width',
    'fill paragraphs',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'wrap',
      choices: [
        { value: 'wrap', label: 'Wrap to width' },
        { value: 'unwrap', label: 'Unwrap to one line per paragraph' },
      ],
    },
    {
      key: 'width',
      label: 'Wrap width (columns)',
      type: 'number',
      default: 80,
      min: 20,
      max: 200,
      step: 1,
      showWhen: { key: 'mode', value: 'wrap' },
    },
    {
      key: 'breakLongWords',
      label: 'Break words longer than the width',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'wrap' },
    },
    {
      key: 'preserveParagraphs',
      label: 'Preserve blank lines between paragraphs',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Wrap to 40 columns',
      input:
        'The quick brown fox jumps over the lazy dog and then keeps on running well past the horizon.',
      options: { mode: 'wrap', width: 40 },
    },
    {
      title: 'Unwrap wrapped lines',
      input: 'This paragraph was\nhard-wrapped into\nshort lines.\n\nThis one too.',
      options: { mode: 'unwrap' },
    },
    {
      title: 'Break a long token',
      input: 'prefix aaaaaaaaaaaaaaaaaaaaaaaa suffix',
      options: { mode: 'wrap', width: 10, breakLongWords: true },
    },
  ],
  article: [
    {
      heading: 'Wrap to a width or unwrap a paragraph',
      body: 'Wrap mode fills each line with as many whole words as fit inside the chosen column width, then starts the next line, which is exactly what a plain-text email, commit message or Markdown source needs. Unwrap is the inverse: it joins the hard-wrapped lines of each paragraph back into one long line so the text can be re-flowed at a different width.',
    },
    {
      heading: 'Paragraphs are kept apart',
      body: 'A run of blank lines marks a paragraph boundary. With the preserve option on, those gaps survive and each paragraph is wrapped or unwrapped on its own, so list blocks and headings are not glued together. Whitespace inside a paragraph is collapsed to single spaces before wrapping, removing stray indentation from the original.',
    },
    {
      heading: 'Long words and tokens',
      body: 'A URL or hash longer than the width cannot be broken at a space, so by default it overflows its line. Turning on the long-word option splits such tokens at the column boundary instead, trading readability for a guaranteed maximum width — useful when generating fixed-width text for a terminal or a diff.',
    },
    {
      heading: 'No text leaves the page',
      body: 'Reflowing is a local string operation with no server involved. Nothing is uploaded or retained, so drafts, leaked logs or any other sensitive prose can be reformatted here without a network round trip.',
    },
  ],
  faq: [
    {
      q: 'How does wrapping decide where to break?',
      a: 'Greedy word wrap: it fills each line with as many whitespace-separated words as fit within the width, then starts a new line. Runs of whitespace inside a paragraph are collapsed to single spaces.',
    },
    {
      q: 'What counts as a paragraph break?',
      a: 'One or more blank lines. With "Preserve blank lines" on, those gaps are kept and each paragraph is wrapped or unwrapped independently.',
    },
    {
      q: 'What happens to a word longer than the width?',
      a: 'By default it is left intact and overflows past the column, keeping the word readable. Enable "Break words longer than the width" to split it exactly at the boundary instead.',
    },
  ],
  related: ['indent-text', 'text-repeat', 'case-convert', 'sort-lines'],
  status: 'stable',
};
