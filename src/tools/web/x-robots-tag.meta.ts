import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'x-robots-tag',
  name: 'X-Robots-Tag Analyzer',
  category: 'web',
  summary: 'Validate per-resource indexing directives (X-Robots-Tag).',
  description:
    'Analyze and generate the X-Robots-Tag response header, which applies robots directives to an individual URL (unlike the site-wide robots.txt). Validates directives such as noindex, nofollow, noarchive, nosnippet, max-snippet, and indexifembedded, warns on conflicts, and spot-checks per-resource crawler targeting via the optional group suffix.',
  keywords: [
    'X-Robots-Tag',
    'noindex',
    'nofollow',
    'noarchive',
    'robots directive',
    'search engine',
    'max-snippet',
    'max-image-preview',
    'indexifembedded',
    'crawler header',
    'SEO robot header',
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
        { value: 'analyze', label: 'Analyze header' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'value', label: 'Directives', type: 'text', default: 'noindex, nofollow' },
  ],
  examples: [
    { title: 'Analyze a robots tag', input: 'noindex, nofollow' },
    { title: 'Build a noindex header', options: { mode: 'build', value: 'noindex, noarchive' } },
  ],
  related: ['robots-txt', 'meta-tags', 'user-agent'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
