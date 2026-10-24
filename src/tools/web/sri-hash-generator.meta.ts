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
    { title: 'Integrity value without markup', options: { algorithm: 'sha256', element: 'none' } },
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
  article: [
    {
      heading: 'What an integrity value looks like',
      body: 'Paste the exact contents of a script or stylesheet and the tool hashes those bytes with SHA-256, SHA-384 or SHA-512, then prints the integrity value as the algorithm name, a hyphen and the Base64 digest. With a snippet option it wraps that value in a full tag that already carries crossorigin="anonymous".',
    },
    {
      heading: 'Pinning a third-party CDN',
      body: 'Use it when a page loads a library or font stylesheet from a CDN and you want the browser to refuse a swapped file. Hash the build you actually ship, so a compromised CDN serving different bytes gets its resource blocked instead of executed.',
    },
    {
      heading: 'Choosing the algorithm and the snippet',
      body: 'SHA-384 is the default middle ground. SHA-512 spends a longer digest on more bits and SHA-256 is the shortest. The element option changes only the surrounding markup, not the hash, and the integrity-only choice hands back the bare value for a tag you write yourself.',
    },
    {
      heading: 'Hash exactly what the browser fetches',
      body: 'The digest covers the pasted text, so a trailing newline, a file that differs from the deployed one, or an HTML error page served in place of the asset all yield a hash that will not match. Compression is fine, because integrity is checked after decoding.',
    },
    {
      heading: 'Digested on your own machine',
      body: 'The bytes go through the browser’s own crypto.subtle in this tab, so vendored or unreleased code is never transmitted and the generator works offline.',
    },
  ],
  related: ['http-header-analyzer', 'repr-digest', 'hash'],
  status: 'stable',
};
