import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'diff-text',
  name: 'Text Diff',
  category: 'developer',
  summary:
    'Compare two blocks of text and see the differences as a unified diff or an inline word/character diff.',
  description:
    'Paste the original text as A and the changed text as B, then get the differences by line, word, or character. Choose a unified-diff view with @@ hunk headers or an inline view that marks [-removed-] and {+added+} spans in place.',
  keywords: [
    'text diff',
    'diff',
    'compare text',
    'difference checker',
    'unified diff',
    'inline diff',
    'word diff',
    'character diff',
    'text comparison',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'second',
      label: 'Text B (compare against)',
      type: 'textarea',
      default: '',
      placeholder: 'Paste the changed / new version here',
    },
    {
      key: 'granularity',
      label: 'Compare by',
      type: 'select',
      default: 'lines',
      choices: [
        { value: 'lines', label: 'Lines' },
        { value: 'words', label: 'Words' },
        { value: 'chars', label: 'Characters' },
      ],
    },
    {
      key: 'format',
      label: 'Output style',
      type: 'select',
      default: 'unified',
      choices: [
        { value: 'unified', label: 'Unified diff (--- / +++ / @@)' },
        { value: 'inline', label: 'Inline [-removed-] {+added+}' },
      ],
    },
  ],
  examples: [
    {
      title: 'Unified line diff',
      input: 'apple\nbanana\ncherry',
      options: { second: 'apple\nBANANA\ncherry', granularity: 'lines', format: 'unified' },
    },
    {
      title: 'Inline word diff',
      input: 'the quick brown fox',
      options: { second: 'the slow brown fox', granularity: 'words', format: 'inline' },
    },
    {
      title: 'Character diff',
      input: 'kitten',
      options: { second: 'sitting', granularity: 'chars', format: 'unified' },
    },
  ],
  related: ['json-diff', 'regex-tester', 'find-replace', 'sort-lines'],
  credits: [{ name: 'jsdiff', url: 'https://github.com/kpdecker/jsdiff', license: 'BSD-3-Clause' }],
  status: 'stable',
};
