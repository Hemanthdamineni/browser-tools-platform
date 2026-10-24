import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x-frame-options',
  name: 'X-Frame-Options Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect clickjacking frame controls.',
  description:
    'Generate or analyze the X-Frame-Options response header. Validates DENY and SAMEORIGIN values, flags the deprecated ALLOW-FROM form, and explains the interplay with CSP frame-ancestors for modern framing protection.',
  keywords: [
    'X-Frame-Options',
    'XFO',
    'clickjacking',
    'DENY',
    'SAMEORIGIN',
    'frame-ancestors',
    'framing protection',
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
        { value: 'analyze', label: 'Analyze value' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'value',
      label: 'Policy',
      type: 'select',
      default: 'DENY',
      choices: [
        { value: 'DENY', label: 'DENY' },
        { value: 'SAMEORIGIN', label: 'SAMEORIGIN' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze framing behavior', input: 'SAMEORIGIN' },
    { title: 'Build a strict frame policy', options: { mode: 'build', value: 'DENY' } },
    { title: 'Inspect an ALLOW-FROM value', input: 'ALLOW-FROM https://example.com' },
  ],
  article: [
    {
      heading: 'What the header does',
      body: 'Build mode emits DENY or SAMEORIGIN once the value passes validation, and analyze mode reports the normalized value, a valid or invalid status, and a plain description of the framing it permits. Anything outside the accepted list is refused rather than quietly passed through.',
    },
    {
      heading: 'The two supported values',
      body: 'DENY stops any origin at all from framing the page. SAMEORIGIN allows only pages from the same origin to frame it. Input is compared case-insensitively, so deny and SameOrigin both work, and the result is echoed back in upper case.',
    },
    {
      heading: 'The ALLOW-FROM trap',
      body: 'Any ALLOW-FROM value is flagged as deprecated, because modern browsers dropped support for it and never agreed on how it should behave. When a particular origin needs to frame the page, reach for the CSP frame-ancestors directive instead.',
    },
    {
      heading: 'How it meets CSP',
      body: 'If a response also carries frame-ancestors, browsers that understand CSP ignore X-Frame-Options entirely. Sending both remains a sensible fallback for older clients that do not support CSP, at no real cost.',
    },
    {
      heading: 'Checked in the browser',
      body: 'Header values are validated and built entirely on-device. Nothing is uploaded and no request is issued.',
    },
  ],
  faq: [
    {
      q: 'What does X-Frame-Options do?',
      a: 'It tells the browser whether the page may be framed, helping prevent clickjacking attacks where a page is embedded in a malicious overlay.',
    },
    {
      q: 'What is the deprecated ALLOW-FROM?',
      a: 'ALLOW-FROM was removed from browsers because it was hard to implement safely; use the CSP frame-ancestors directive instead.',
    },
    {
      q: 'Should I still use XFO?',
      a: 'Browsers that support CSP ignore XFO when frame-ancestors is present. Use frame-ancestors for modern control and XFO for older clients that do not support CSP.',
    },
  ],
  related: ['security-headers', 'content-security-policy', 'permissions-policy'],
  status: 'stable',
};
