import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sri-hash-generator',
  name: 'Subresource Integrity (SRI) Hash Generator',
  category: 'web',
  summary: 'Generate SRI integrity hashes for scripts and styles.',
  description:
    'Generate Subresource Integrity (SRI) integrity strings for web resources. Hashes pasted content with SHA-256, SHA-384, or SHA-512 on-device and emits the integrity attribute value and a ready-to-paste HTML snippet.',
  keywords: [
    'SRI',
    'Subresource Integrity',
    'integrity attribute',
    'sha256',
    'sha384',
    'sha512',
    'crossorigin anonymous',
    'script integrity',
    'security hash',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'algorithm',
      label: 'Hash algorithm',
      type: 'select',
      default: 'sha384',
      choices: [
        { value: 'sha256', label: 'SHA-256' },
        { value: 'sha384', label: 'SHA-384' },
        { value: 'sha512', label: 'SHA-512' },
      ],
    },
    {
      key: 'element',
      label: 'Element snippet',
      type: 'select',
      default: 'script',
      choices: [
        { value: 'script', label: 'Script' },
        { value: 'link', label: 'Style link' },
        { value: 'none', label: 'Integrity only' },
      ],
    },
  ],
  examples: [
    {
      title: 'Hash an inline script payload',
      input: 'window.app.bootstrap()',
      options: { algorithm: 'sha384' },
    },
    { title: 'Style link integrity', options: { algorithm: 'sha512', element: 'link' } },
  ],
  faq: [
    {
      q: 'What is SRI?',
      a: 'It lets a browser verify that a fetched script or style matches the published hash, protecting against tampered third-party resources.',
    },
    {
      q: 'Which algorithm is recommended?',
      a: 'sha384 is the widely-used balance; sha512 provides more bits at a larger digest size.',
    },
    {
      q: 'When do I need crossorigin?',
      a: 'Cross-origin resources require the crossorigin="anonymous" attribute for SRI to work correctly.',
    },
  ],
  related: ['http-header-analyzer', 'repr-digest', 'hash'],
  status: 'stable',
};
