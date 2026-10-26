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
  related: ['number-base', 'timestamp', 'json-format'],
  status: 'stable',
};
