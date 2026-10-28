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
  related: [  "json-format",
  "html-entities",
  "json-to-typescript"],
  status: 'stable',
};
