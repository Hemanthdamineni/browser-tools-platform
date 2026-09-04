import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'uuid-namespace',
  name: 'Namespaced UUID (v3 / v5)',
  category: 'developer',
  summary:
    'Generate a deterministic name-based UUID (v5 SHA-1 or v3 MD5) from a namespace and name.',
  description:
    'Hash a namespace UUID together with a name to produce a stable version 5 (SHA-1) or version 3 (MD5) UUID. The same namespace and name always yield the same id. The name is the text you enter.',
  keywords: [
    'uuid',
    'uuid v5',
    'uuid v3',
    'namespace uuid',
    'name-based uuid',
    'deterministic uuid',
    'rfc 4122',
    'rfc 9562',
    'sha-1',
    'md5',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'version',
      label: 'Version',
      type: 'select',
      default: 'v5',
      choices: [
        { value: 'v5', label: 'v5 — SHA-1 (recommended)' },
        { value: 'v3', label: 'v3 — MD5' },
      ],
    },
    {
      key: 'namespace',
      label: 'Namespace',
      type: 'select',
      default: 'dns',
      choices: [
        { value: 'dns', label: 'DNS (6ba7b810-…)' },
        { value: 'url', label: 'URL (6ba7b811-…)' },
        { value: 'oid', label: 'ISO OID (6ba7b812-…)' },
        { value: 'x500', label: 'X.500 DN (6ba7b814-…)' },
        { value: 'custom', label: 'Custom UUID…' },
      ],
    },
    {
      key: 'customNamespace',
      label: 'Custom namespace UUID',
      type: 'text',
      default: '',
      placeholder: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      showWhen: { key: 'namespace', value: 'custom' },
    },
  ],
  examples: [
    {
      title: 'v5 DNS for "python.org"',
      input: 'python.org',
      options: { version: 'v5', namespace: 'dns' },
    },
    {
      title: 'v3 DNS for "python.org"',
      input: 'python.org',
      options: { version: 'v3', namespace: 'dns' },
    },
    {
      title: 'v5 URL for a page',
      input: 'https://example.com/page',
      options: { version: 'v5', namespace: 'url' },
    },
  ],
  faq: [
    {
      q: 'Which version should I use?',
      a: 'Prefer v5. It uses SHA-1, which is stronger than the MD5 used by v3. Use v3 only for compatibility with a system that already produces it.',
    },
    {
      q: 'Are these random?',
      a: 'No. Name-based UUIDs are fully deterministic — the same namespace and name always produce the same UUID, on any machine.',
    },
    {
      q: 'What are the standard namespaces?',
      a: 'RFC 4122 defines DNS 6ba7b810-9dad-11d1-80b4-00c04fd430c8, URL 6ba7b811-…, OID 6ba7b812-… and X.500 6ba7b814-… (all sharing the same suffix).',
    },
  ],
  related: ['uuid', 'objectid', 'snowflake', 'hash'],
  status: 'stable',
};
