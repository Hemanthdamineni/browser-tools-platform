import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'surrogate-control',
  name: 'Surrogate-Control Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Surrogate-Control intermediary-cache directives.',
  description:
    'Generate or analyze the Surrogate-Control response header used by reverse proxies and CDNs. Validates delta-seconds, quoted content selectors, duplicates, and storage conflicts while explaining that browsers generally ignore this proxy-specific field.',
  keywords: [
    'Surrogate-Control',
    'reverse proxy cache',
    'CDN cache',
    'surrogate keys',
    'edge caching',
    'max-age',
    'content selector',
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
      default: 'max-age=3600, content="ESI/1.0"',
    },
  ],
  examples: [
    { title: 'Analyze intermediary policy', input: 'max-age=3600, content="ESI/1.0"' },
    {
      title: 'Build proxy cache policy',
      options: { mode: 'build', directives: 'max-age=600, no-store' },
    },
  ],
  faq: [
    {
      q: 'Who reads Surrogate-Control?',
      a: 'Reverse proxies and surrogate caches may use it to control intermediary behavior; ordinary browsers generally do not use it as their cache policy.',
    },
    {
      q: 'What does content mean?',
      a: 'The content directive can identify surrogate processing technologies, such as ESI, supported by an intermediary.',
    },
    {
      q: 'Is this a universal CDN standard?',
      a: 'Support and precedence vary by proxy or CDN. Verify the target provider documentation before relying on it.',
    },
  ],
  related: [  "cache-headers",
  "content-type"],
  hidden: true,
  redirectTo: 'cache-headers',
  status: 'stable',
};
