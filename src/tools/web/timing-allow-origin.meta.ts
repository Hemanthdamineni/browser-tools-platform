import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'timing-allow-origin',
  name: 'Timing-Allow-Origin Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect cross-origin timing data access.',
  description:
    'Generate or analyze the Timing-Allow-Origin response header. Validates wildcard and origin tokens, flags broad or duplicate grants, and explains how TAO controls which origins may read resource timing information.',
  keywords: [
    'Timing-Allow-Origin',
    'TAO',
    'resource timing',
    'performance timing',
    'cross-origin timing',
    'PerformanceResourceTiming',
    'timing header',
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
        { value: 'analyze', label: 'Analyze origin list' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'origins',
      label: 'Origins (comma-separated)',
      type: 'text',
      default: 'https://metrics.example.com',
    },
  ],
  examples: [
    { title: 'Analyze timing origins', input: '* https://metrics.example.com' },
    {
      title: 'Build a metrics grant',
      options: { mode: 'build', origins: 'https://metrics.example.com' },
    },
  ],
  faq: [
    {
      q: 'What does Timing-Allow-Origin control?',
      a: 'It whitelists origins that are allowed to read cross-origin resource timing metrics from PerformanceResourceTiming.',
    },
    {
      q: 'What does the wildcard grant?',
      a: 'A * value allows any origin to read timing data, which can expose load-duration details.',
    },
    {
      q: 'Is it related to CORS?',
      a: 'It is a separate header from CORS but serves a similar allowlisting role specifically for performance timing data.',
    },
  ],
  related: [  "http-header-analyzer",
  "security-headers",
  "cross-origin-resource-policy"],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
