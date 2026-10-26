import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-security-policy',
  name: 'Content-Security-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect CSP directives and sources.',
  description:
    'Generate or analyze Content-Security-Policy response values. Validates common directives and their source expressions, flags unsafe-inline, unsafe-eval, wildcard sources, and missing default-src, and explains report-only rollout and supported directives.',
  keywords: [
    'Content-Security-Policy',
    'CSP',
    'default-src',
    'script-src',
    'unsafe-inline',
    'unsafe-eval',
    'nonce',
    'frame-ancestors',
    'security policy',
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
    { key: 'defaultSrc', label: 'default-src', type: 'text', default: "'self'" },
    { key: 'scriptSrc', label: 'script-src', type: 'text', default: "'self'" },
    { key: 'styleSrc', label: 'style-src', type: 'text', default: "'self'" },
    { key: 'imgSrc', label: 'img-src', type: 'text', default: "'self' data:" },
    { key: 'connectSrc', label: 'connect-src', type: 'text', default: "'self'" },
    { key: 'frameAncestors', label: 'frame-ancestors', type: 'text', default: "'none'" },
    { key: 'objectSrc', label: 'object-src', type: 'text', default: "'none'" },
  ],
  examples: [
    { title: 'Analyze a strict policy', input: "default-src 'self'; script-src 'self'" },
    {
      title: 'Build a strict policy',
      options: {
        mode: 'build',
        defaultSrc: "'self'",
        scriptSrc: "'self'",
        imgSrc: "'self' data:",
        frameAncestors: "'none'",
      },
    },
    {
      title: 'Analyze a policy with a wildcard source',
      input: "default-src 'self'; img-src *; script-src 'unsafe-inline'",
    },
  ],
  related: ['security-headers', 'x-frame-options', 'http-header-analyzer'],
  status: 'stable',
};
