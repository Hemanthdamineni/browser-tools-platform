import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'permissions-policy',
  name: 'Permissions-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect browser capability policy directives.',
  description: 'Generate or analyze Permissions-Policy response directives. Validates feature names and allowlist origins, detects duplicate directives and broad wildcard grants, and explains iframe delegation and browser enforcement locally.',
  keywords: ['Permissions-Policy', 'Feature-Policy', 'browser permissions', 'iframe delegation', 'camera policy', 'geolocation policy', 'allowlist'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze policy' }, { value: 'build', label: 'Build policy' }] },
    { key: 'feature', label: 'Feature', type: 'text', default: 'camera' },
    { key: 'allowlist', label: 'Allowlist (space-separated)', type: 'text', default: 'self' },
  ],
  examples: [
    { title: 'Analyze capability policy', input: 'camera=(self "https://video.example"), geolocation=()' },
    { title: 'Build a camera policy', options: { mode: 'build', feature: 'camera', allowlist: 'self "https://video.example"' } },
  ],
  faq: [
    { q: 'What does Permissions-Policy control?', a: 'It controls whether browser features such as camera, microphone, geolocation, or fullscreen may be used by a document and delegated frames.' },
    { q: 'What does an empty allowlist mean?', a: 'An empty list, written (), disables that feature for the document and its frames.' },
    { q: 'Is this the old Feature-Policy header?', a: 'Permissions-Policy is the current header name. Browser support and feature names evolve, so test the target browsers.' },
  ],
  related: ['security-headers', 'accept-ch', 'content-security-policy'],
  status: 'stable',
};
