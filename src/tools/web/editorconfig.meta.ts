import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'editorconfig',
  name: '.editorconfig Generator',
  category: 'web',
  summary: 'Generate an .editorconfig with your indentation, line-ending and charset settings.',
  description:
    'Configure indentation style and size, end-of-line, charset, whitespace trimming, final newlines and an optional max line length — then copy a valid .editorconfig that editors and IDEs read automatically.',
  keywords: [
    'editorconfig',
    'editor config',
    'indent style',
    'indent size',
    'line endings',
    'lf crlf',
    'file conventions',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'indentStyle',
      label: 'Indent style',
      type: 'select',
      default: 'space',
      choices: [
        { value: 'space', label: 'spaces' },
        { value: 'tab', label: 'tabs' },
      ],
    },
    { key: 'indentSize', label: 'Indent size', type: 'number', default: 2, min: 1 },
    {
      key: 'endOfLine',
      label: 'End of line',
      type: 'select',
      default: 'lf',
      choices: [
        { value: 'lf', label: 'lf' },
        { value: 'crlf', label: 'crlf' },
      ],
    },
    {
      key: 'charset',
      label: 'Charset',
      type: 'select',
      default: 'utf-8',
      choices: [
        { value: 'utf-8', label: 'utf-8' },
        { value: 'latin1', label: 'latin1' },
      ],
    },
    {
      key: 'trimTrailingWhitespace',
      label: 'Trim trailing whitespace',
      type: 'boolean',
      default: true,
    },
    { key: 'insertFinalNewline', label: 'Insert final newline', type: 'boolean', default: true },
    {
      key: 'maxLineLength',
      label: 'Max line length (0 = omit)',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    { title: 'Defaults' },
    { title: 'Tabs for a Go project', options: { indentStyle: 'tab' } },
    {
      title: 'Four spaces, CRLF, 100-column limit',
      options: { indentSize: 4, endOfLine: 'crlf', maxLineLength: 100 },
    },
  ],
  related: ['gitignore', 'robots-txt'],
  status: 'stable',
};
