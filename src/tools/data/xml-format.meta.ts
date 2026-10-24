import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'xml-format',
  name: 'XML Formatter',
  category: 'data',
  summary:
    'Pretty-print or minify XML with a pure-JS tokenizer — comments, CDATA and PIs kept intact.',
  description:
    'Reindent XML for readability or strip it down to a single line. A hand-written tokenizer splits the document into tags, text, comments, CDATA sections, processing instructions and doctype declarations, so no browser XML parser is involved. Unbalanced tags are reported as a warning; genuinely broken markup raises an error.',
  keywords: [
    'xml formatter',
    'xml beautifier',
    'pretty print xml',
    'format xml',
    'minify xml',
    'xml pretty',
    'indent xml',
    'xml prettifier',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'pretty',
      choices: [
        { value: 'pretty', label: 'Pretty-print' },
        { value: 'minify', label: 'Minify' },
      ],
    },
    {
      key: 'indent',
      label: 'Indent',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
        { value: 'tab', label: 'Tab' },
      ],
      showWhen: { key: 'operation', value: 'pretty' },
    },
  ],
  examples: [
    {
      title: 'Pretty-print',
      input: '<root><child>text</child><child/></root>',
      options: { operation: 'pretty' },
    },
    {
      title: 'Minify',
      input: '<root>\n  <child>text</child>\n</root>',
      options: { operation: 'minify' },
    },
    {
      title: 'Keeps comments and CDATA',
      input: '<a><!-- note --><![CDATA[x < y]]></a>',
      options: { operation: 'pretty', indent: '4' },
    },
  ],
  faq: [
    {
      q: 'Does it use the browser XML parser?',
      a: 'No. Tokenizing and re-emitting is done by hand in plain JavaScript, so DOMParser is never called and the input is not validated against a schema.',
    },
    {
      q: 'What counts as broken markup?',
      a: 'An unterminated tag, comment, CDATA or processing instruction, or a stray "<" inside a tag (for example "<a<"). These raise an error. Mismatched or unclosed element tags only produce a warning and a best-effort result.',
    },
    {
      q: 'Is whitespace inside elements preserved?',
      a: 'Minify drops text nodes that are only whitespace and keeps the rest verbatim. Pretty-print collapses internal runs of whitespace in text to a single space.',
    },
  ],
  article: [
    {
      heading: 'Pretty-printing and minifying XML',
      body: 'Paste an XML document and either reindent it for reading or collapse it onto a single line. A hand-written tokenizer splits the source into tags, text, comments, CDATA sections, processing instructions and doctype declarations, and the chosen operation re-emits those tokens as text you can copy or download as formatted.xml.',
    },
    {
      heading: 'When to reformat an XML document',
      body: 'Reach for it when a config file, SOAP response or sitemap arrives with no indentation and you need to see the hierarchy, or when you want to strip out whitespace before shipping a smaller file.',
    },
    {
      heading: 'Indentation and whitespace handling',
      body: 'The operation picks pretty-print or minify. Indent chooses two spaces, four spaces or a tab and applies only to pretty-printing. Minify drops text nodes that are nothing but whitespace and keeps the rest verbatim, while pretty-print collapses runs of whitespace inside text to a single space.',
    },
    {
      heading: 'What counts as broken markup',
      body: 'An unterminated tag, comment, CDATA section or processing instruction, or a stray angle bracket inside a tag name, raises an error. Mismatched or unclosed element tags are reported only as a warning, and you still get a best-effort result. Because no browser XML parser is called, the document is never schema-validated.',
    },
    {
      heading: 'Formatted entirely on your device',
      body: 'The tokenizer and reformatter run in the browser on the text you supply, so the document is never uploaded and the formatting works offline.',
    },
  ],
  related: ['json-format', 'html-entities', 'json-to-typescript'],
  status: 'stable',
};
