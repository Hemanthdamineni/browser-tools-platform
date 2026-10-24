import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'permissions-policy',
  name: 'Permissions-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect browser capability policy directives.',
  description:
    'Generate or analyze Permissions-Policy response directives. Validates feature names and allowlist origins, detects duplicate directives and broad wildcard grants, and explains iframe delegation and browser enforcement locally.',
  keywords: [
    'Permissions-Policy',
    'Feature-Policy',
    'browser permissions',
    'iframe delegation',
    'camera policy',
    'geolocation policy',
    'allowlist',
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
        { value: 'analyze', label: 'Analyze policy' },
        { value: 'build', label: 'Build policy' },
      ],
    },
    { key: 'feature', label: 'Feature', type: 'text', default: 'camera' },
    { key: 'allowlist', label: 'Allowlist (space-separated)', type: 'text', default: 'self' },
  ],
  examples: [
    {
      title: 'Analyze capability policy',
      input: 'camera=(self "https://video.example"), geolocation=()',
    },
    {
      title: 'Build a camera policy',
      options: { mode: 'build', feature: 'camera', allowlist: 'self "https://video.example"' },
    },
    {
      title: 'Disable a feature outright',
      options: { mode: 'build', feature: 'geolocation', allowlist: 'none' },
    },
  ],
  faq: [
    {
      q: 'What does Permissions-Policy control?',
      a: 'It controls whether browser features such as camera, microphone, geolocation, or fullscreen may be used by a document and delegated frames.',
    },
    {
      q: 'What does an empty allowlist mean?',
      a: 'An empty list, written (), disables that feature for the document and its frames.',
    },
    {
      q: 'Is this the old Feature-Policy header?',
      a: 'Permissions-Policy is the current header name. Browser support and feature names evolve, so test the target browsers.',
    },
  ],
  article: [
    {
      heading: 'Turning capability policy into a table',
      body: 'Paste comma-separated directives such as camera=(self "https://video.example"), geolocation=() and the analyser splits them into a table of feature, allowlist and status. Empty parentheses show as (empty) and are counted as disabled. Build mode takes one feature name and a space-separated allowlist and assembles the directive.',
    },
    {
      heading: 'Locking a page down before an embed',
      body: 'Reach for this when a page embeds third-party frames and you need to be sure only the intended origins may reach the camera, microphone or geolocation, or when a feature should be off for the document entirely.',
    },
    {
      heading: 'Origins, none and the wildcard',
      body: 'An allowlist accepts self, an explicit https origin in quotes, the * wildcard or none. The analyser flags * as a broad grant worth reviewing, rejects none combined with another origin, and reports duplicate feature directives and malformed allowlist tokens.',
    },
    {
      heading: 'Feature names and browser support',
      body: 'Feature names use lowercase letters, digits and hyphens, and a directive can be grammatically valid while a browser ignores a feature it does not implement, so test the browsers you actually ship to.',
    },
    {
      heading: 'Analysed without leaving the browser',
      body: 'Both the parser and the builder are page code, so the policy you paste, internal hostnames included, is never uploaded and the tool keeps working offline.',
    },
  ],
  related: ['security-headers', 'http-header-analyzer', 'content-security-policy'],
  status: 'stable',
};
