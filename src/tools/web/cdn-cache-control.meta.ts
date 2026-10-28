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
  faq: [
    {
      q: 'How does this differ from Cache-Control?',
      a: 'CDN-Cache-Control is commonly used for CDN-specific policy, while Cache-Control is the standardized general cache directive field consumed by browsers and shared caches.',
    },
    {
      q: 'Does a CDN have to honor it?',
      a: 'Only if the CDN supports the field and its documented precedence rules. Treat it as provider-specific behavior, not a universal browser contract.',
    },
    {
      q: 'Are stale responses always safe?',
      a: 'No. Stale serving can expose outdated or user-specific data; pair policies with correct cache keys and privacy controls.',
    },
  ],
  related: [  "cache-headers"],
  hidden: true,
  redirectTo: 'cache-headers',
  status: 'stable',
};
