import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'docx-to-markdown',
  name: 'DOCX to Markdown',
  category: 'converters',
  summary: 'Turn a Word .docx into Markdown or plain text locally — headings, lists and tables.',
  description:
    'Read a Word document (.docx/.docm) in your browser and convert it to Markdown or plain text, preserving headings, bold/italic, hyperlinks, bullet and numbered lists, and tables. Nothing is uploaded. Legacy binary .doc files and OpenDocument .odt files are not supported.',
  keywords: [
    'docx',
    'word to markdown',
    'word to text',
    'docx converter',
    'extract text from word',
    'docx to md',
    'office document',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept:
    '.docx,.docm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-word.document.macroEnabled.12',
  multiple: true,
  options: [
    {
      key: 'output',
      label: 'Output format',
      type: 'select',
      default: 'markdown',
      choices: [
        { value: 'markdown', label: 'Markdown' },
        { value: 'text', label: 'Plain text' },
      ],
    },
    {
      key: 'headings',
      label: 'Convert heading styles to Markdown headings',
      type: 'boolean',
      default: true,
      showWhen: { key: 'output', value: 'markdown' },
    },
    {
      key: 'tables',
      label: 'Convert tables',
      type: 'boolean',
      default: true,
    },
    {
      key: 'images',
      label: 'Images',
      type: 'select',
      default: 'skip',
      help: 'Skip images, embed them as data URIs, or reference extracted files.',
      choices: [
        { value: 'skip', label: 'Skip' },
        { value: 'embed', label: 'Embed as data URI' },
        { value: 'link', label: 'Extract & link' },
      ],
    },
    {
      key: 'escape',
      label: 'Escape Markdown special characters',
      type: 'boolean',
      default: true,
      showWhen: { key: 'output', value: 'markdown' },
    },
  ],
  examples: [
    { title: 'Convert a .docx to Markdown' },
    {
      title: 'Plain text with images embedded',
      options: { output: 'text', images: 'embed' },
    },
    {
      title: 'Markdown with extracted images',
      options: { output: 'markdown', images: 'link' },
    },
  ],
  related: ['markdown-to-html', 'html-to-text', 'pdf-extract-text', 'zip-extract'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
