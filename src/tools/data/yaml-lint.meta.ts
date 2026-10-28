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
    {
      title: 'Tab used for indentation',
      input: 'root:\n\tnested: 1',
    },
  ],
  related: ['json-to-yaml', 'csv-to-yaml', 'yaml-to-json', 'ini-convert'],
  status: 'stable',
};
