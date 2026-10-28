import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-inspector',
  name: 'Text Encoding & Character Inspector',
  category: 'developer',
  summary: 'Inspect BOMs, line endings, control characters, and Unicode code points in text.',
  description:
    'Analyze pasted text for common Unicode byte-order marks, newline styles, control and format characters, zero-width marks, and unusual code points. Findings include code point and line/column without changing the input. Text remains in your browser.',
  keywords: [
    'text encoding inspector',
    'unicode inspector',
    'character code point',
    'find invisible characters',
    'zero width character',
    'bom detector',
    'line ending detector',
    'control character finder',
    'unicode debug',
    'utf-8 bom',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'showAllNonAscii',
      label: 'Include every non-ASCII character',
      type: 'boolean',
      default: false,
    },
    {
      key: 'maxFindings',
      label: 'Maximum character findings',
      type: 'number',
      default: 500,
      min: 10,
    },
  ],
  examples: [
    { title: 'Find zero-width and non-breaking spaces', input: 'one\u00a0two\u200bthree' },
    { title: 'Inspect mixed line endings', input: 'first\r\nsecond\nthird\rfour' },
    { title: 'Inspect a BOM and emoji', input: '\ufeffHello 👋' },
  ],
  related: ['unicode-normalize', 'unicode-lookup', 'line-numbers'],
  status: 'stable',
};
