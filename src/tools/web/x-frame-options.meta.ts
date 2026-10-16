import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x-frame-options',
  name: 'X-Frame-Options Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect clickjacking frame controls.',
  description: 'Generate or analyze the X-Frame-Options response header. Validates DENY and SAMEORIGIN values, flags the deprecated ALLOW-FROM form, and explains the interplay with CSP frame-ancestors for modern framing protection.',
  keywords: ['X-Frame-Options', 'XFO', 'clickjacking', 'DENY', 'SAMEORIGIN', 'frame-ancestors', 'framing protection'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze value' }, { value: 'build', label: 'Build header' }] },
    { key: 'value', label: 'Policy', type: 'select', default: 'DENY', choices: [{ value: 'DENY', label: 'DENY' }, { value: 'SAMEORIGIN', label: 'SAMEORIGIN' }] },
  ],
  examples: [
    { title: 'Analyze framing behavior', input: 'SAMEORIGIN' },
    { title: 'Build a strict frame policy', options: { mode: 'build', value: 'DENY' } },
  ],
  faq: [
    { q: 'What does X-Frame-Options do?', a: 'It tells the browser whether the page may be framed, helping prevent clickjacking attacks where a page is embedded in a malicious overlay.' },
    { q: 'What is the deprecated ALLOW-FROM?', a: 'ALLOW-FROM was removed from browsers because it was hard to implement safely; use the CSP frame-ancestors directive instead.' },
    { q: 'Should I still use XFO?', a: 'Browsers that support CSP ignore XFO when frame-ancestors is present. Use frame-ancestors for modern control and XFO for older clients that do not support CSP.' },
  ],
  related: ['security-headers', 'content-security-policy', 'permissions-policy'],
  status: 'stable',
};
