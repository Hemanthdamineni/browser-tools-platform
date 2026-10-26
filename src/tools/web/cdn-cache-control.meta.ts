import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cdn-cache-control',
  name: 'CDN-Cache-Control Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect CDN-Cache-Control directives.',
  description:
    'Generate or analyze CDN-Cache-Control response directives used by CDNs and shared caches. Validates delta-seconds, quoted values, duplicates, and common directive conflicts while distinguishing CDN policy from browser Cache-Control behavior.',
  keywords: [
    'CDN-Cache-Control',
    'CDN caching',
    'shared cache',
    'edge cache',
    's-maxage',
    'stale-while-revalidate',
    'cache directives',
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
        { value: 'analyze', label: 'Analyze directives' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'directives',
      label: 'Directives',
      type: 'text',
      default: 'max-age=3600, stale-while-revalidate=60',
    },
  ],
  examples: [
    { title: 'Analyze CDN policy', input: 'max-age=3600, stale-while-revalidate=60' },
    {
      title: 'Build edge cache policy',
      options: { mode: 'build', directives: 'max-age=3600, stale-if-error=86400' },
    },
  ],
  related: ['cache-headers'],
  hidden: true,
  redirectTo: 'cache-headers',
  status: 'stable',
};
