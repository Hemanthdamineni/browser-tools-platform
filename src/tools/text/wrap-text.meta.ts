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
  faq: [
    {
      q: 'How does wrapping decide where to break?',
      a: 'Greedy word wrap: it fills each line with as many whitespace-separated words as fit within the width, then starts a new line. Runs of whitespace inside a paragraph are collapsed to single spaces.',
    },
    {
      q: 'What counts as a paragraph break?',
      a: 'One or more blank lines. With "Preserve blank lines" on, those gaps are kept and each paragraph is wrapped or unwrapped independently.',
    },
  ],
  related: ['indent-text', 'text-repeat', 'case-convert', 'sort-lines'],
  status: 'stable',
};
