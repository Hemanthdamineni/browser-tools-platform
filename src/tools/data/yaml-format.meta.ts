import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'yaml-format',
  name: 'YAML Formatter & Validator',
  category: 'data',
  summary: 'Format and validate YAML locally, preserving comments and document streams.',
  description:
    'Parse YAML 1.2 documents and re-emit them with consistent indentation. Comments, anchors, aliases and multi-document streams are handled by the yaml parser. Syntax errors and duplicate keys are reported without producing partial output.',
  keywords: [
    'yaml formatter',
    'yaml beautifier',
    'yaml validator',
    'format yaml',
    'pretty print yaml',
    'yml formatter',
    'yaml prettifier',
    'yaml',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'indent',
      label: 'Indent',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
      ],
    },
  ],
  examples: [
    { title: 'Format mapping', input: 'name: Toolbench\ntags: [a,b]\n' },
    { title: 'Nested data', input: 'service:\n    enabled: true\n    ports: [8080, 8081]\n' },
    { title: 'Multi-document stream', input: '---\nname: first\n---\nname: second\n' },
  ],
  faq: [
    {
      q: 'Which YAML version is supported?',
      a: 'YAML 1.2 is parsed and emitted by the yaml package. Duplicate mapping keys and syntax errors are reported instead of silently overwritten.',
    },
    {
      q: 'Are comments, anchors and multiple documents preserved?',
      a: 'Yes. The formatter works with YAML document objects, retaining comments, anchors, aliases and document boundaries where present.',
    },
    {
      q: 'Does formatting wrap long lines?',
      a: 'No. Line wrapping is disabled so scalar content is not reflowed solely to meet a display width.',
    },
  ],
  related: [  "yaml-to-json",
  "json-to-yaml",
  "xml-format"],
  credits: [{ name: 'yaml', url: 'https://github.com/eemeli/yaml', license: 'ISC' }],
  status: 'stable',
};
