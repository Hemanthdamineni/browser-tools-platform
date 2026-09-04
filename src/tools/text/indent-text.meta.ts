import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'indent-text',
  name: 'Indent / Dedent Text',
  category: 'text',
  summary:
    'Add or remove leading indentation on every line, using spaces or tabs, with an optional skip for blank lines.',
  description:
    'Prefix each line with a chosen number of spaces or tabs, or strip up to that much leading indentation back off. Blank lines can be left untouched.',
  keywords: [
    'indent text',
    'dedent text',
    'add indentation',
    'remove indentation',
    'unindent',
    'reindent',
    'code indent',
    'shift lines',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'indent',
      choices: [
        { value: 'indent', label: 'Indent (add)' },
        { value: 'dedent', label: 'Dedent (remove)' },
      ],
    },
    {
      key: 'unit',
      label: 'Indent unit',
      type: 'select',
      default: 'spaces',
      choices: [
        { value: 'spaces', label: 'Spaces' },
        { value: 'tabs', label: 'Tabs' },
      ],
    },
    {
      key: 'count',
      label: 'Units per level',
      type: 'number',
      default: 2,
      min: 1,
      max: 16,
      step: 1,
    },
    {
      key: 'skipBlank',
      label: 'Leave blank lines untouched',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Indent by 2 spaces',
      input: 'first line\nsecond line',
      options: { mode: 'indent', unit: 'spaces', count: 2 },
    },
    {
      title: 'Dedent by 4 spaces',
      input: '    def f():\n        return 1',
      options: { mode: 'dedent', unit: 'spaces', count: 4 },
    },
    {
      title: 'Indent with one tab',
      input: 'a\nb',
      options: { mode: 'indent', unit: 'tabs', count: 1 },
    },
  ],
  faq: [
    {
      q: 'What does dedent do if a line has less indentation than requested?',
      a: 'It removes whatever leading indentation is there, up to the requested amount, and leaves the rest of the line alone. It never removes non-whitespace characters.',
    },
    {
      q: 'Does dedent mix spaces and tabs?',
      a: 'No. It removes only the selected unit from the start of each line, stopping at the first character that is not that unit.',
    },
  ],
  related: ['wrap-text', 'text-repeat', 'case-convert', 'dedupe-lines'],
  status: 'stable',
};
