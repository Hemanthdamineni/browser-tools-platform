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
  related: ['json-format', 'html-entities', 'json-to-typescript'],
  status: 'stable',
};
