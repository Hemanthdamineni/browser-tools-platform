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
  article: [
    {
      heading: 'Lint first, then normalise',
      body: 'The tool reads the document line by line and builds a logical structure, then reports every problem it finds as a table row with a line and column: tabs used for indentation, an unclosed quote or flow bracket, a duplicate mapping key, or a construct it cannot represent such as an anchor or tag. Only when nothing is wrong does it also emit normalised YAML if you asked for it.',
    },
    {
      heading: 'What the normalised output does',
      body: 'Normalising re-emits the parsed document with consistent indentation at the width you choose (2 to 8 spaces), decodes quoted scalars back to their values, strips trailing comments and adds safe quoting only where a plain scalar would be ambiguous. Because the output is regenerated from values, it parses back to exactly the same data — the change is presentation, not meaning.',
    },
    {
      heading: 'A concrete use',
      body: 'Paste a Kubernetes manifest or a CI workflow that a colleague hand-edited and broken. Instead of the runtime’s terse “mapping values are not allowed here”, you get a list of the offending lines — most often a tab where spaces belonged, or two keys with the same name — so the fix is obvious before the file ever reaches the cluster.',
    },
    {
      heading: 'Scope and privacy',
      body: 'This is a focused validator for the common YAML subset — block and flow collections, quoted and plain scalars, block scalars, comments and document markers — not a full spec-conformant parser; anchors, aliases, tags and multi-document streams are flagged rather than silently misread. The whole analysis runs in the page with no upload, so a secret-laden config never leaves your device.',
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
  related: ['json-to-yaml', 'csv-to-yaml', 'yaml-to-json', 'ini-convert'],
  status: 'stable',
};
