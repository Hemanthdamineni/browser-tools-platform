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
  faq: [
    {
      q: 'Is my document uploaded anywhere?',
      a: 'No. The .docx is unpacked and converted entirely inside this browser tab; no bytes leave your device and the tool works offline.',
    },
    {
      q: 'Why does my old .doc file not work?',
      a: 'The older binary .doc format is not a ZIP of XML and cannot be read in a browser. Open it in Word/LibreOffice and save as .docx (or PDF) first.',
    },
    {
      q: 'What is preserved?',
      a: 'Paragraphs, heading levels (from Word styles), bold, italic, strikethrough, super/subscript, hyperlinks, tabs and line breaks, bullet and numbered lists, and tables. Images can optionally be embedded or extracted.',
    },
    {
      q: 'Are equations, charts and text boxes included?',
      a: 'Text in a paragraph body is included. Complex objects such as equations, embedded charts, SmartArt, headers/footers, footnotes and comments are not converted.',
    },
  ],
  article: [
    {
      heading: 'What a .docx actually holds',
      body: 'A Word .docx is a ZIP package, so this tool unpacks it in the browser and reads the word/document.xml part directly instead of driving any Office software. Each input becomes one output named after the original, so report.docx becomes report.md. Paragraphs, heading levels taken from Word styles, bold, italic, strikethrough and super/subscript runs, hyperlinks, tabs, bullet and numbered lists, and tables are all carried across.',
    },
    {
      heading: 'When a Word document needs converting',
      body: 'Reach for it when moving a formatted report into a wiki, a README or a static site and you would rather not retype it. Drop in one file or several; with more than one you also get a summary table of words, paragraphs, tables, headings and images per document.',
    },
    {
      heading: 'Output, headings, tables and escaping',
      body: 'The output option switches between Markdown and plain text. Making heading styles into Markdown headings and escaping special characters apply only to Markdown, so turning escaping off leaves asterisks and underscores literal. Tables can be suppressed for either output.',
    },
    {
      heading: 'Images and the practical limits',
      body: 'Images are skipped by default; embed inlines them as data URIs, while extract and link writes a companion name.assets folder, so download the zip to keep the links intact. A file above 50 MB is refused, as are legacy .doc, RTF, .xlsx, .pptx and .odt inputs, each with a message naming what was detected.',
    },
    {
      heading: 'Converted without leaving the tab',
      body: 'Unpacking, parsing and rendering happen entirely in your browser, so the document is never uploaded and the tool keeps working with no connection.',
    },
  ],
  related: ['markdown-to-html', 'html-to-text', 'pdf-extract-text', 'zip-extract'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
