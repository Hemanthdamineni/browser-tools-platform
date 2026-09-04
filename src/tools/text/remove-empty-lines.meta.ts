import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'remove-empty-lines',
  name: 'Remove Empty Lines',
  category: 'text',
  summary:
    'Strip blank and whitespace-only lines, collapse blank runs to one, or trim trailing blanks.',
  description:
    'Clean up spacing in a block of text. Drop every empty or whitespace-only line, collapse runs of blank lines down to a single separator, or just remove blank lines hanging off the end.',
  keywords: [
    'remove empty lines',
    'delete blank lines',
    'strip blank lines',
    'collapse blank lines',
    'trim trailing lines',
    'whitespace',
    'clean text',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'remove-all',
      choices: [
        { value: 'remove-all', label: 'Remove all blank lines' },
        { value: 'collapse', label: 'Collapse runs to one blank line' },
        { value: 'trim-trailing', label: 'Trim trailing blank lines only' },
      ],
    },
  ],
  examples: [
    {
      title: 'Remove every blank line',
      input: 'one\n\n\ntwo\n   \nthree\n',
      options: { mode: 'remove-all' },
    },
    {
      title: 'Collapse double blanks',
      input: 'one\n\n\n\ntwo\n\n\nthree',
      options: { mode: 'collapse' },
    },
    {
      title: 'Trim trailing blanks',
      input: 'one\ntwo\n\n\n',
      options: { mode: 'trim-trailing' },
    },
  ],
  faq: [
    {
      q: 'Does a line with only spaces or tabs count as blank?',
      a: 'Yes. In every mode a line is "blank" when it contains nothing but whitespace.',
    },
    {
      q: 'What does collapse do to leading blank lines?',
      a: 'Any run of consecutive blank lines anywhere in the text — including at the start — is reduced to a single blank line.',
    },
  ],
  related: ['dedupe-lines', 'line-numbers', 'sort-lines', 'find-replace'],
  status: 'stable',
};
