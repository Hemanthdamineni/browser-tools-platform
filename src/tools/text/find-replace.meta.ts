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
  article: [
    {
      heading: 'Three ways to match',
      body: 'Plain text finds the literal characters and replaces every occurrence. Whole word matches a word on its own with word boundaries, so "cat" in "category" is left alone while "cat" in "a cat" is replaced. Regular expression treats the Find field as a pattern and lets you build complex matches, with the flags field controlling behaviour — g for all matches, i to ignore case, m for multi-line. The stats line reports how many replacements were actually made.',
    },
    {
      heading: 'Backreferences in the replacement',
      body: 'In regex mode the replacement string is passed through untouched, so $1, $<name> and $& all work: capture groups with parentheses and reference them in the output, for example swapping first and last name with (\\w+) (\\w+) replaced by $2, $1. In plain and whole-word mode a literal $ is preserved as-is rather than interpreted, because there are no capture groups to expand.',
    },
    {
      heading: 'A realistic workflow',
      body: 'Renaming a variable across a file, normalising spacing, or de-duplicating a label by rewriting a pattern are all one paste away. For a copy you want to keep, toggle Case insensitive so that Title, title and TITLE are all caught in a single pass, or fold it off when case carries meaning and only exact matches should change.',
    },
    {
      heading: 'Errors and privacy',
      body: 'An invalid regular expression or an unknown flag raises a clear error instead of silently doing nothing, so a broken pattern is caught immediately. The replace runs in the page with no request and no upload, so a confidential document stays on your device and the whole operation works offline.',
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
  faq: [
    {
      q: 'Are $1 backreferences supported?',
      a: 'In regex mode, yes — the replacement string is passed through untouched, so $1, $<name> and $& all work. In plain and whole-word mode a literal $ is kept as-is.',
    },
    {
      q: 'What happens with an invalid pattern?',
      a: 'An invalid regular expression or an unknown flag raises a friendly error instead of a silent no-op.',
    },
    {
      q: 'Does it replace every match?',
      a: 'Plain and whole-word mode always replace all matches. Regex mode replaces all only when the flags include "g".',
    },
  ],
  related: ['remove-empty-lines', 'line-numbers', 'case-convert', 'slugify'],
  status: 'stable',
};
