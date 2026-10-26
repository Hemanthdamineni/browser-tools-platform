import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'find-replace',
  name: 'Find and Replace',
  category: 'text',
  summary:
    'Replace text by plain string, whole word, or regular expression, with optional case folding.',
  description:
    'Swap one piece of text for another across the whole input. Match a literal string, a whole word only, or a full regular expression with custom flags and $1 backreferences in the replacement.',
  keywords: [
    'find and replace',
    'search and replace',
    'string replace',
    'regex replace',
    'substitute text',
    'replace all',
    'whole word replace',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'find',
      label: 'Find',
      type: 'text',
      default: '',
      placeholder: 'text or pattern to match',
    },
    {
      key: 'replace',
      label: 'Replace with',
      type: 'text',
      default: '',
      placeholder: 'replacement (empty deletes matches)',
    },
    {
      key: 'mode',
      label: 'Match mode',
      type: 'select',
      default: 'plain',
      choices: [
        { value: 'plain', label: 'Plain text' },
        { value: 'regex', label: 'Regular expression' },
        { value: 'whole-word', label: 'Whole word' },
      ],
    },
    {
      key: 'flags',
      label: 'Regex flags',
      type: 'text',
      default: 'g',
      placeholder: 'e.g. g, gi, gm',
      showWhen: { key: 'mode', value: 'regex' },
    },
    {
      key: 'caseInsensitive',
      label: 'Case insensitive',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Plain replace',
      input: 'the cat sat on the mat',
      options: { find: 'the', replace: 'a' },
    },
    {
      title: 'Whole word only',
      input: 'cat category catalog cat',
      options: { find: 'cat', replace: 'dog', mode: 'whole-word' },
    },
    {
      title: 'Regex with backreference',
      input: 'Jane Doe',
      options: { find: '(\\w+) (\\w+)', replace: '$2, $1', mode: 'regex', flags: 'g' },
    },
  ],
  related: ['remove-empty-lines', 'line-numbers', 'case-convert', 'slugify'],
  status: 'stable',
};
