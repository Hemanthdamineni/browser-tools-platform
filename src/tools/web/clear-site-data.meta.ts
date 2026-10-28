import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'clear-site-data',
  name: 'Clear-Site-Data Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect site storage-wipe signals.',
  description:
    'Generate or analyze the Clear-Site-Data response header. Validates quoted targets (cache, cookies, storage, executionContexts, and the * wildcard), detects duplicates and wildcard combinations, and explains logout and secure-scope requirements locally.',
  keywords: [
    'Clear-Site-Data',
    'clear cookies',
    'clear storage',
    'clear cache',
    'logout header',
    'site data wipe',
    'wildcard directive',
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
        { value: 'analyze', label: 'Analyze targets' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'targets',
      label: 'Targets (comma-separated)',
      type: 'text',
      default: '"cookies", "storage"',
    },
  ],
  examples: [
    { title: 'Analyze wipe targets', input: '"cookies", "storage"' },
    {
      title: 'Build a logout wipe',
      options: { mode: 'build', targets: '"cookies", "storage", "cache"' },
    },
  ],
  faq: [
    {
      q: 'When is Clear-Site-Data used?',
      a: 'Commonly on logout or account-reset responses to ask the browser to clear cookies, storage, or cache for the site.',
    },
    {
      q: 'What does the wildcard clear?',
      a: 'The * target requests clearing all supported data types; browsers that do not support a type may ignore it.',
    },
    {
      q: 'Does it work over plain HTTP?',
      a: 'No. Browsers require the response to be secure (HTTPS) and typically apply it only to the secure origin context.',
    },
  ],
  related: [  "security-headers",
  "set-cookie",
  "origin-agent-cluster"],
  status: 'stable',
};
