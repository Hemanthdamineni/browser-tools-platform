import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'unicode-normalize',
  name: 'Unicode Normalizer',
  category: 'text',
  summary: 'Normalize Unicode text, optionally remove accents and standardize line endings.',
  description:
    'Apply Unicode NFC, NFD, NFKC or NFKD normalization to make text compare and store consistently. Optionally strip combining marks and convert mixed line endings to LF, CRLF or CR.',
  keywords: [
    'unicode',
    'normalize',
    'normalization',
    'nfc',
    'nfd',
    'nfkc',
    'nfkd',
    'accents',
    'diacritics',
    'line endings',
    'utf-8',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'form',
      label: 'Normalization form',
      type: 'select',
      default: 'NFC',
      choices: [
        { value: 'NFC', label: 'NFC (canonical compose)' },
        { value: 'NFD', label: 'NFD (canonical decompose)' },
        { value: 'NFKC', label: 'NFKC (compatibility compose)' },
        { value: 'NFKD', label: 'NFKD (compatibility decompose)' },
      ],
    },
    {
      key: 'stripMarks',
      label: 'Remove combining marks (accents)',
      type: 'boolean',
      default: false,
    },
    {
      key: 'lineEndings',
      label: 'Line endings',
      type: 'select',
      default: 'preserve',
      choices: [
        { value: 'preserve', label: 'Preserve' },
        { value: 'lf', label: 'LF (Unix)' },
        { value: 'crlf', label: 'CRLF (Windows)' },
        { value: 'cr', label: 'CR (Classic Mac)' },
      ],
    },
  ],
  examples: [
    { title: 'Compose an accented character', input: 'Cafe\u0301' },
    { title: 'Compatibility characters', input: '① ＡＢＣ ™', options: { form: 'NFKC' } },
    { title: 'Remove accents', input: 'Crème brûlée — déjà vu', options: { stripMarks: true } },
  ],
  related: ['slugify', 'case-convert', 'json-format'],
  status: 'stable',
};
