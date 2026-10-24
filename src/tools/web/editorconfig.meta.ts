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
      body: 'The output starts with root = true, which tells editors to stop searching parent directories for another .editorconfig, then a [*] section that applies to every file: indent style, indent size, end of line, charset, trailing-whitespace trimming and final-newline insertion. If you set a maximum line length above zero, a max_line_length line is added too. A final [*.md] section is appended for reasons the Markdown question below explains.',
    },
    {
      heading: 'Indentation: spaces versus tabs',
      body: 'With spaces selected the file sets both indent_style = space and indent_size = the number you chose (1 to 8). With tabs selected only indent_style = tab is written, because indent_size has no agreed meaning for tabs and editors interpret it differently. That single difference is why the generator does not simply always emit both keys.',
    },
    {
      heading: 'Line endings, charset and whitespace',
      body: 'End of line chooses between lf (the Unix and modern default) and crlf (Windows). Charset offers utf-8 and latin1; UTF-8 is what almost every project wants today. Trailing-whitespace trimming and final-newline insertion are each a plain true/false, and the two together are the most common source of noisy diffs when they are inconsistent across a team.',
    },
    {
      heading: 'The Markdown override, and what to watch for',
      body: 'Markdown treats two trailing spaces as a hard line break, so a global trim rule would silently change how a document renders. The generator therefore always writes a [*.md] section with trim_trailing_whitespace = false. One caveat: .editorconfig is honoured by plugins, not by every editor out of the box, so a colleague may need to enable support before the rules take effect for them.',
    },
    {
      heading: 'Generated locally, ready to commit',
      body: 'Nothing is uploaded and no repository is contacted; the file is assembled from your choices in this tab. Copy it into your project root as .editorconfig and it applies to every file in the tree beneath it.',
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
