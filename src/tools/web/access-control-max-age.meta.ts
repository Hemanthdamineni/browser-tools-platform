import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-max-age',
  name: 'Access-Control-Max-Age Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect the CORS preflight cache time.',
  description: 'Generate or analyze the Access-Control-Max-Age response header that tells browsers how long (in seconds) to cache a CORS preflight response. Validates non-negative integer values, notes per-browser caps such as the ~600-second Firefox/Chromium limit, and advises when to omit the header.',
  keywords: ['Access-Control-Max-Age', 'CORS preflight cache', 'preflight options', 'cache duration', 'max-age CORS', 'CORS options caching', 'request caching'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'analyze', choices: [{ value: 'analyze', label: 'Analyze value' }, { value: 'build', label: 'Build header' }] },
    { key: 'seconds', label: 'Seconds', type: 'text', default: '600' },
  ],
  examples: [
    { title: 'Analyze a cache duration', input: '600' },
    { title: 'Build a five-minute cache', options: { mode: 'build', seconds: '600' } },
  ],
  faq: [
    { q: 'What does this header do?', a: 'It caches a successful CORS preflight so the browser skips the OPTIONS round-trip for subsequent requests within the window.' },
    { q: 'Is the value always honored?', a: 'Browsers cap it: Firefox caps around 25 hours but Chromium historically ~5 minutes (600s), and some ignore it entirely, so do not rely on it.' },
    { q: 'When should I omit it?', a: 'If you change CORS rules often, a short value or omission avoids stale preflight caches during rollout.' },
  ],
  related: ['cors-headers'],
  hidden: true,
  redirectTo: 'cors-headers',
  status: 'stable',
};
