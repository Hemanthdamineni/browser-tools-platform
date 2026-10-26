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
  related: ['remove-empty-lines', 'sort-lines', 'dedupe-lines', 'find-replace'],
  status: 'stable',
};
