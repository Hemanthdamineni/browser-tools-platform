import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'etag',
  name: 'ETag Builder & Analyzer',
  category: 'web',
  summary: 'Build and compare HTTP entity tags for conditional requests.',
  description:
    'Generate quoted ETag values from a token, or analyze If-None-Match and If-Match lists with wildcard, weak, and strong comparison semantics. Everything runs locally; no resource is fetched or hashed remotely.',
  keywords: [
    'etag generator',
    'ETag analyzer',
    'If-None-Match',
    'If-Match',
    'HTTP cache validator',
    'weak etag',
    'strong etag comparison',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze tags' },
        { value: 'build', label: 'Build ETag' },
        { value: 'compare', label: 'Compare tags' },
      ],
    },
    { key: 'weak', label: 'Weak tag (W/)', type: 'boolean', default: false },
    { key: 'secondTag', label: 'Second tag (compare mode)', type: 'text', default: '' },
    {
      key: 'comparison',
      label: 'Comparison',
      type: 'select',
      default: 'weak',
      choices: [
        { value: 'weak', label: 'Weak (If-None-Match)' },
        { value: 'strong', label: 'Strong (If-Match)' },
      ],
    },
  ],
  examples: [
    { title: 'Build a weak ETag', input: 'asset-v42', options: { mode: 'build', weak: true } },
    { title: 'Analyze a conditional request', input: 'W/"abc", "def", *' },
    {
      title: 'Compare validators',
      input: 'W/"abc"',
      options: { mode: 'compare', secondTag: '"abc"', comparison: 'weak' },
    },
  ],
  faq: [
    {
      q: 'What is the difference between weak and strong comparison?',
      a: 'Weak comparison treats W/"abc" and "abc" as equivalent. Strong comparison requires both tags to be strong and their opaque values to match exactly.',
    },
    {
      q: 'Does this hash my file or response?',
      a: 'No. It generates tags from the token you provide and never reads files or fetches resources.',
    },
    {
      q: 'What does * mean?',
      a: 'The wildcard matches any current representation in conditional request headers such as If-None-Match and If-Match.',
    },
  ],
  related: ['cache-headers', 'checksum-validator', 'file-hash'],
  hidden: true,
  redirectTo: 'conditional-request-headers',
  status: 'stable',
};
