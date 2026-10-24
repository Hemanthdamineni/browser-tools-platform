import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dedupe-lines',
  name: 'Remove Duplicate Lines',
  category: 'text',
  summary: 'Delete repeated lines from a list, keeping the first or last occurrence.',
  description:
    'Strip duplicates from a list of lines. Optionally ignore case and surrounding whitespace when comparing, keep only lines that appeared more than once, or invert to keep only the unique ones.',
  keywords: ['deduplicate', 'remove duplicates', 'unique lines', 'distinct', 'uniq'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'keep',
      label: 'Keep',
      type: 'select',
      default: 'first',
      choices: [
        { value: 'first', label: 'First occurrence' },
        { value: 'last', label: 'Last occurrence' },
        { value: 'only-duplicates', label: 'Only lines that repeat' },
        { value: 'only-unique', label: 'Only lines that appear once' },
      ],
    },
    { key: 'ignoreCase', label: 'Ignore case', type: 'boolean', default: false },
    { key: 'trim', label: 'Ignore leading/trailing spaces', type: 'boolean', default: false },
    { key: 'keepBlank', label: 'Never remove blank lines', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'De-dupe', input: 'a\nb\na\nc\nb' },
    { title: 'Only repeats', input: 'a\nb\na\nc\nb', options: { keep: 'only-duplicates' } },
    {
      title: 'Case-insensitive de-dupe, keeping the last',
      input: 'Apple\napple\nBanana',
      options: { keep: 'last', ignoreCase: true },
    },
  ],
  faq: [
    {
      q: 'Does it re-sort the output?',
      a: 'No. Original order is preserved. Use Sort Lines first if you also want it sorted.',
    },
    {
      q: 'What do the two filter modes do?',
      a: 'Only lines that repeat keeps just the lines whose comparison key occurs more than once, and Only lines that appear once does the opposite. In both cases each surviving line is emitted once, at the position of its first appearance, so a run of three identical lines contributes a single output line.',
    },
    {
      q: 'How are blank lines treated?',
      a: 'With the never-remove-blank-lines option on, blank lines always pass through untouched in every mode. With it off, a blank line is compared like any other, so a run of empty lines collapses to one in the keep-first mode and only the final one survives in keep-last.',
    },
  ],
  article: [
    {
      heading: 'What removing duplicates produces',
      body: 'The tool works line by line: it groups lines by a comparison key, decides which copy of each group to keep, and writes the survivors back in their original order. The output is plain text with the same newline structure as the input, and the stats report how many lines were kept and how many were removed. Nothing is sorted or reordered, so a list that arrived in a meaningful sequence stays in that sequence after the duplicates are gone.',
    },
    {
      heading: 'The four ways to choose a survivor',
      body: 'Keep-first is the default: the earliest copy of each line survives and later duplicates disappear. Keep-last does the reverse, keeping the final occurrence and dropping the earlier ones, which matters when a later line corrects an earlier one in a log or a config dump. The two filter modes go further: only-lines-that-repeat keeps the lines that appeared more than once and drops the singletons, while only-lines-that-appear-once keeps the singletons and drops the repeats. Each surviving line in a filter mode is emitted once, at its first position.',
    },
    {
      heading: 'How comparison keys are formed',
      body: 'The ignore-case and ignore-spaces options change the key used for comparison, never the text that is written out. With ignore-case on, Apple and apple are treated as the same line and whichever the chosen mode keeps is emitted exactly as it was typed. With the trim option on, surrounding whitespace is stripped before comparison, so an indented duplicate still counts as a repeat while the kept line keeps its indentation. Blank lines are the exception: with the never-remove-blank-lines option on they always survive, whatever the mode.',
    },
    {
      heading: 'Where it fits and where it runs',
      body: 'This is a line-level tool, so it will not merge lines that differ only in a trailing comma or a timestamp — clean those up first if they should count as equal. Because order is preserved, pair it with the sort tool when you want a sorted unique list rather than an as-found one. Everything is a pure text pass in your browser: the list you paste is deduplicated locally and never uploaded, and no request is made while it runs.',
    },
  ],
  related: ['sort-lines', 'whitespace-cleanup', 'unique-words'],
  status: 'stable',
};
