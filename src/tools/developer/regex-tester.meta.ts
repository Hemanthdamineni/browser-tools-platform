import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'regex-tester',
  name: 'Regex Tester',
  category: 'developer',
  summary:
    'Test a JavaScript regular expression against text — highlight, list matches, replace or split.',
  description:
    'Run a JavaScript (ECMAScript) regular expression against your input. See every match with its capture groups and index, wrap matches in markers, apply a replacement with $1/$<name> references, or split the text on the pattern.',
  keywords: [
    'regex',
    'regexp',
    'regular expression',
    'regex tester',
    'pattern match',
    'capture group',
    'find and replace',
    'split',
    'javascript regex',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'pattern',
      label: 'Pattern',
      type: 'text',
      default: '',
      placeholder: '\\b\\w+\\b',
      help: 'The regular expression source, without slashes. Required.',
    },
    {
      key: 'flags',
      label: 'Flags',
      type: 'text',
      default: 'gm',
      placeholder: 'gm',
      help: 'Any combination of g i m s u y.',
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'matches',
      choices: [
        { value: 'highlight', label: 'Highlight matches (<<…>>)' },
        { value: 'matches', label: 'List matches (table)' },
        { value: 'replace', label: 'Replace' },
        { value: 'split', label: 'Split' },
      ],
    },
    {
      key: 'replacement',
      label: 'Replacement',
      type: 'text',
      default: '$&',
      placeholder: '$1',
      help: 'Supports $& (whole match), $1 and $<name> back-references.',
      showWhen: { key: 'mode', value: 'replace' },
    },
  ],
  examples: [
    {
      title: 'List all numbers',
      input: 'order a1, item b22, code c333',
      options: { pattern: '\\d+', mode: 'matches' },
    },
    {
      title: 'Mask vowels',
      input: 'hello world',
      options: { pattern: '[aeiou]', flags: 'g', mode: 'replace', replacement: '*' },
    },
    {
      title: 'Split on comma + space',
      input: 'red, green, blue',
      options: { pattern: ',\\s*', mode: 'split' },
    },
  ],
  related: ['find-replace', 'cron-parser', 'slugify', 'case-convert'],
  status: 'stable',
};
