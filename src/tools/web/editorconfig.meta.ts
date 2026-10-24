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
    { key: 'indentSize', label: 'Indent size', type: 'number', default: 2, min: 1, max: 8 },
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
      max: 200,
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
  article: [
    {
      heading: 'What the generated file contains',
      body: 'The output starts with root = true, which tells editors to stop searching parent directories, then a [*] section that applies to every file: indent style, indent size, end of line, charset, trailing-whitespace trimming and final-newline insertion. Setting a maximum line length above zero adds a max_line_length line, and a final [*.md] section is appended.',
    },
    {
      heading: 'Indentation: spaces versus tabs',
      body: 'With spaces selected the file sets indent_style = space and indent_size = your chosen number (1 to 8). With tabs selected only indent_style = tab is written, because indent_size has no agreed meaning for tabs and editors interpret it differently \u2014 which is why the generator does not simply always emit both keys.',
    },
    {
      heading: 'Line endings, charset and whitespace',
      body: 'End of line is lf, the Unix and modern default, or crlf for Windows, and charset is utf-8 or latin1. Trailing-whitespace trimming and final-newline insertion are each a plain true or false, and those two settings together are the most common source of noisy diffs when a team disagrees about them.',
    },
    {
      heading: 'The Markdown override, and what to watch for',
      body: 'Markdown treats two trailing spaces as a hard line break, so a global trim rule would silently change rendering, which is why a [*.md] section always sets trim_trailing_whitespace = false. The file is assembled from your choices in this tab with nothing uploaded; note that .editorconfig needs editor or plugin support before the rules take effect.',
    },
  ],
  faq: [
    {
      q: 'Why the [*.md] override?',
      a: 'Markdown uses two trailing spaces as a hard line break, so trimming trailing whitespace in .md files would silently change rendering. The generator therefore always sets trim_trailing_whitespace = false for Markdown.',
    },
    {
      q: 'What does root = true mean?',
      a: 'It marks this file as the top of the configuration chain, so editors stop looking for another .editorconfig in parent directories. It is what you want in a repository root.',
    },
    {
      q: 'Why is indent_size missing when I pick tabs?',
      a: 'Editors disagree about what an indent_size means for tab characters, so the generator writes only indent_style = tab. If you need a tab width, set it in the editor or in a language-specific section instead.',
    },
  ],
  related: ['gitignore', 'robots-txt'],
  status: 'stable',
};
