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
  article: [
    {
      heading: 'Parse and re-emit with consistent indentation',
      body: 'The tool runs your text through a YAML 1.2 parser and writes it back out with a uniform two- or four-space indent. Because it works from parsed document objects rather than raw text edits, comments, anchors and aliases survive the round trip, and multi-document streams stay separated by document boundaries. The result is offered as formatted.yaml.',
    },
    {
      heading: 'Validation before any output',
      body: 'Documents are parsed with duplicate-key detection enabled, so a mapping that repeats a key or a value that cannot be parsed is reported as a syntax error and no partial output is produced — you see the parser message instead of a silently mangled file. The indentation option only changes the emit indent; it does not reinterpret the structure.',
    },
    {
      heading: 'Line wrapping is disabled on purpose',
      body: 'The emitter is set with a zero line width, which means long scalar content is not reflowed to fit a display column. This keeps block strings and flow scalars byte-for-byte faithful to what was written, which matters when the file is consumed by another tool or diffed against its original.',
    },
    {
      heading: 'What is and is not standardised',
      body: 'Only YAML 1.2 syntax is supported — not the older YAML 1.1 tag set. Emoji and unusual scalars are preserved as written. Formatting is best-effort canonical emission, not a linter: it will not sort keys, strip blank lines, or otherwise change the meaning of the document.',
    },
    {
      heading: 'Parsing stays on your device',
      body: 'The whole operation is string processing in this tab using the yaml package, and no network request is made, so your configuration never leaves the browser and the tool works offline. Duplicate keys and warnings are surfaced as readable messages.',
    },
  ],
  related: ['yaml-to-json', 'json-to-yaml', 'xml-format'],
  credits: [{ name: 'yaml', url: 'https://github.com/eemeli/yaml', license: 'ISC' }],
  status: 'stable',
};
