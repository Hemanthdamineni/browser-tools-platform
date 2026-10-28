import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'robots-txt',
  name: 'robots.txt Generator',
  category: 'web',
  summary: 'Generate a robots.txt: allow all, block all, block AI crawlers, or custom rules.',
  description:
    'Create a correct robots.txt for your site. Pick a preset — allow everything, block everything, or block the major AI training crawlers — or compose custom User-agent / Allow / Disallow rules, with optional Crawl-delay and Sitemap lines.',
  keywords: [
    'robots.txt',
    'robots txt generator',
    'disallow',
    'crawl delay',
    'block ai bots',
    'gptbot',
    'crawler rules',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'preset',
      label: 'Preset',
      type: 'select',
      default: 'allow-all',
      choices: [
        { value: 'allow-all', label: 'Allow everything' },
        { value: 'block-all', label: 'Block everything' },
        { value: 'block-ai-bots', label: 'Block AI crawlers' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    {
      key: 'userAgents',
      label: 'User-agents (comma-separated)',
      type: 'text',
      default: '*',
      showWhen: { key: 'preset', value: 'custom' },
    },
    {
      key: 'disallow',
      label: 'Disallow paths (one per line)',
      type: 'textarea',
      default: '',
      showWhen: { key: 'preset', value: 'custom' },
    },
    {
      key: 'allow',
      label: 'Allow paths (one per line)',
      type: 'textarea',
      default: '',
      showWhen: { key: 'preset', value: 'custom' },
    },
    { key: 'sitemapUrl', label: 'Sitemap URL (optional)', type: 'text', default: '' },
    {
      key: 'crawlDelay',
      label: 'Crawl-delay (seconds, 0 = omit)',
      type: 'number',
      default: 0,
      min: 0,
      max: 60,
    },
  ],
  examples: [{ title: 'Block AI crawlers' }],
  faq: [
    {
      q: 'Does blocking AI crawlers really keep my content out of training sets?',
      a: 'It signals polite crawlers (GPTBot, CCBot, ClaudeBot, …) not to fetch your site. It cannot bind operators who ignore robots.txt, and it does nothing against humans or scraper networks that ignore it.',
    },
  ],
  related: [  "gitignore",
  "editorconfig",
  "meta-tags"],
  status: 'stable',
};
