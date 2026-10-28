import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'yaml-lint',
  name: 'YAML Lint & Normalize',
  category: 'data',
  summary: 'Validate YAML and reformat it with consistent 2-space indentation and correct quoting.',
  description:
    'Lint a YAML document on your device and get a checklist-style table of issues — tab indentation, unclosed quotes or flow brackets, duplicate mapping keys, and unsupported constructs — each with a line and column. When the document is well-formed it is re-emitted as normalized YAML: consistent indentation, decoded quoted scalars, stripped trailing comments, and safe quoting so the output parses back to the same values. Supports block mappings and sequences, flow collections, single/double-quoted scalars, block scalars, comments and document markers.',
  keywords: [
    'yaml linter',
    'yaml validator',
    'yaml lint online',
    'yaml check',
    'yaml formatter',
    'yaml prettify',
    'validate yaml',
    'yaml normalize',
    'yaml syntax check',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'normalize',
      label: 'Also emit normalized YAML',
      type: 'boolean',
      default: true,
    },
    {
      key: 'indent',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 2,
      max: 8,
    },
  ],
  examples: [
    {
      title: 'Well-formed nesting',
      input: 'server:\n  host: localhost\n  ports:\n    - 80\n    - 443\n  debug: true',
    },
    {
      title: 'Duplicate key',
      input: 'name: alice\nname: bob\nrole: admin',
    },
  ],
  faq: [
    {
      q: 'Which YAML features are validated?',
      a: 'Block mappings and sequences with nesting, flow collections ([…] and {…}, including multi-line), plain and single/double-quoted scalars, block scalars (| and >), comments, and document markers (---). Anchors, aliases, tags and multi-document streams are reported as unsupported rather than silently misparsed.',
    },
    {
      q: 'Does "normalize" change the meaning?',
      a: 'No. Values are re-emitted with safe quoting rules, so numbers, booleans and nulls keep their native meaning and strings are quoted only when a plain scalar would be ambiguous. Trailing comments are stripped after values, which is cosmetic.',
    },
    {
      q: 'What makes linting fail?',
      a: 'Tabs used for indentation, unclosed quotes or brackets, duplicate keys inside the same mapping, inconsistent block indentation, and empty input are reported as errors so you can fix the document.',
    },
    {
      q: 'Is this a full YAML parser?',
      a: 'It is a focused validator and normalizer for the common YAML subset described above — enough to catch most real-world mistakes — not a conformance implementation of the whole spec.',
    },
  ],
  related: [  "json-to-yaml",
  "csv-to-yaml",
  "yaml-to-json",
  "ini-convert"],
  status: 'stable',
};
