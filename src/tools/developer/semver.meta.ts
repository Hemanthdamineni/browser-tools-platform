import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'semver',
  name: 'Semantic Version Tool',
  category: 'developer',
  summary: 'Validate, compare, and sort Semantic Versioning 2.0.0 values.',
  description:
    'Check strict SemVer 2.0.0 strings, compare two versions, or sort a newline-separated list. Handles prerelease precedence exactly and ignores build metadata for precedence while preserving it in output.',
  keywords: [
    'semantic version',
    'semver',
    'version compare',
    'sort versions',
    'prerelease version',
    'version validator',
    'npm version',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'validate',
      choices: [
        { value: 'validate', label: 'Validate versions' },
        { value: 'compare', label: 'Compare two versions' },
        { value: 'sort', label: 'Sort versions' },
      ],
    },
    { key: 'secondVersion', label: 'Second version (compare mode)', type: 'text', default: '' },
    { key: 'descending', label: 'Descending sort', type: 'boolean', default: false },
  ],
  article: [
    {
      heading: 'What gets checked and printed',
      body: 'The input is a newline-separated list of version strings, each checked against strict SemVer 2.0.0: MAJOR.MINOR.PATCH with an optional -prerelease and +build part. Validate mode returns a three-column table of every line with Valid or Invalid and, when it fails, the expected shape.',
    },
    {
      heading: 'A release-day use',
      body: 'Before tagging a release, paste the candidate versions from your package manifests or CI matrix and confirm every one is well formed. In sort mode the same list comes back ordered by precedence, so you can see whether the new tag really sits after the last one.',
    },
    {
      heading: 'Modes and the two extra options',
      body: 'The mode select chooses validate, compare or sort. Compare takes exactly one version in the box and pairs it with the second version field, printing whether the first is less than, greater than or of equal precedence to the second. The descending toggle reverses the sort output.',
    },
    {
      heading: 'Strictness and build metadata',
      body: 'A leading v, surrounding whitespace inside the token or another prefix is rejected, and sort refuses to run if any line is invalid. Build metadata is ignored when comparing precedence but is kept in the displayed and sorted strings. A prerelease always sorts below the plain version.',
    },
    {
      heading: 'Nothing leaves the tab',
      body: 'All parsing and comparison runs in your browser; no version string is uploaded and the page keeps working offline. That makes it safe for private version numbers that have not been published yet.',
    },
  ],
  examples: [
    { title: 'Validate prerelease versions', input: '1.2.3\n2.0.0-rc.1\n1.0.0+build.7' },
    {
      title: 'Compare versions',
      input: '1.0.0-rc.1',
      options: { mode: 'compare', secondVersion: '1.0.0' },
    },
    {
      title: 'Sort releases',
      input: '1.0.0\n2.0.0\n1.10.0\n1.0.0-alpha',
      options: { mode: 'sort' },
    },
  ],
  faq: [
    {
      q: 'Does build metadata affect comparison?',
      a: 'No. SemVer 2.0.0 says build metadata is ignored for precedence. It is preserved in displayed and sorted values.',
    },
    {
      q: 'Are leading v prefixes accepted?',
      a: 'No. This tool validates strict SemVer 2.0.0. Remove a leading v, whitespace, or other tag prefix before checking.',
    },
    {
      q: 'How are prereleases ordered?',
      a: 'A version with a prerelease has lower precedence than the corresponding normal version. Numeric identifiers compare numerically, and numeric identifiers always precede non-numeric identifiers.',
    },
  ],
  related: ['number-base', 'timestamp', 'json-format'],
  status: 'stable',
};
