import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'line-numbers',
  name: 'Add Line Numbers',
  category: 'text',
  summary:
    'Prefix every line with a running number, with configurable start, separator, zero-padding.',
  description:
    'Number each line of a block of text. Pick the first number, the separator style, optional zero-padding to a fixed width, and whether blank lines are skipped or numbered.',
  keywords: [
    'line numbers',
    'add line numbers',
    'number lines',
    'numbered list',
    'prefix lines',
    'enumerate lines',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'start',
      label: 'Start number',
      type: 'number',
      default: 1,
      step: 1,
    },
    {
      key: 'zeroPad',
      label: 'Zero-pad to equal width',
      type: 'boolean',
      default: false,
    },
    {
      key: 'separator',
      label: 'Separator',
      type: 'select',
      default: 'dot-space',
      choices: [
        { value: 'dot-space', label: 'Dot + space ("1. ")' },
        { value: 'pipe', label: 'Pipe ("1 | ")' },
        { value: 'tab', label: 'Tab ("1\\t")' },
        { value: 'paren', label: 'Parenthesis ("1) ")' },
        { value: 'colon', label: 'Colon ("1: ")' },
      ],
    },
    {
      key: 'skipBlank',
      label: 'Skip blank lines',
      type: 'boolean',
      default: false,
    },
  ],
  article: [
    {
      heading: 'A running number in front of every line',
      body: 'Paste a block of text and each line comes back prefixed with a number. Start number sets the first value, Separator picks the style — "1. ", "1 | ", a tab, "1) " or "1: " — and Zero-pad to equal width pads the prefix with zeros so every number takes the width of the largest one printed.',
    },
    {
      heading: 'Quoting lines back to someone',
      body: 'It is the tool for turning a pasted log, a config file or a stack trace into something you can refer to line by line in a code review, a support ticket or a bug report, and for preparing a numbered procedure in prose.',
    },
    {
      heading: 'The two switches',
      body: 'Skip blank lines leaves empty lines exactly where they are but does not number them and does not advance the counter, so the numbering tracks content rather than rows. Zero-pad derives the width from the highest number that will actually be printed, so a run from 1 to 9 stays single-digit while a run to 120 becomes three digits wide.',
    },
    {
      heading: 'Caveats',
      body: 'Lines are split on newline only, so a file with old Mac-style CR-only endings is treated as one long line. A file ending in a newline has a final empty line, numbered or skipped per the blank-line setting. The counter never restarts inside a block.',
    },
    {
      heading: 'Numbered in the page',
      body: 'The text is transformed in your browser and nothing is uploaded, so numbering a file full of internal paths, configuration values or customer data is safe — and it works offline.',
    },
  ],
  examples: [
    {
      title: 'Number three lines',
      input: 'alpha\nbeta\ngamma',
      options: { start: 1, separator: 'dot-space' },
    },
    {
      title: 'Zero-padded from 0',
      input: 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk',
      options: { start: 0, zeroPad: true, separator: 'paren' },
    },
    {
      title: 'Skip blank lines',
      input: 'first\n\nthird',
      options: { skipBlank: true, separator: 'pipe' },
    },
  ],
  faq: [
    {
      q: 'What happens to blank lines when "Skip blank lines" is on?',
      a: 'They stay exactly where they are but get no number, and they do not advance the counter.',
    },
    {
      q: 'How wide is the zero-padding?',
      a: 'The width of the largest number that will be printed, so every prefix lines up.',
    },
    {
      q: 'Can I number only part of a file?',
      a: 'Paste just the range you want numbered, or number everything and delete the lines you do not need. There is no "start after line N" rule: the counter simply begins at the Start number you set.',
    },
  ],
  related: ['remove-empty-lines', 'sort-lines', 'dedupe-lines', 'find-replace'],
  status: 'stable',
};
