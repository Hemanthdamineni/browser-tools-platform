import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'prefer-header',
  name: 'Prefer Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Prefer negotiation directives for APIs.',
  description:
    'Generate or analyze Prefer request directives such as return=minimal, return=representation, respond-async, and wait. Validates tokens, quoted values, duplicate preferences, and common API negotiation issues locally.',
  keywords: [
    'Prefer header',
    'return=minimal',
    'respond-async',
    'HTTP wait preference',
    'API preference header',
    'RFC 7240',
    'Prefer parser',
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
        { value: 'analyze', label: 'Analyze preferences' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'preference',
      label: 'Preference',
      type: 'select',
      default: 'return=minimal',
      choices: ['return=minimal', 'return=representation', 'respond-async', 'wait=60'].map(
        (value) => ({ value, label: value }),
      ),
    },
    { key: 'custom', label: 'Custom preference (optional)', type: 'text', default: '' },
  ],
  examples: [
    { title: 'Analyze API preferences', input: 'return=minimal, respond-async, wait=30' },
    {
      title: 'Build a minimal response request',
      options: { mode: 'build', preference: 'return=minimal' },
    },
  ],
  faq: [
    {
      q: 'Does Prefer force a server to honor a request?',
      a: 'No. It expresses a client preference. Servers may honor it, ignore it, or communicate applied preferences with Preference-Applied.',
    },
    {
      q: 'What does wait mean?',
      a: 'wait=n asks the server to wait up to n seconds before responding, when supported.',
    },
    {
      q: 'Are custom preferences allowed?',
      a: 'Yes. Applications can define extension preferences, but both sides must agree on their meaning.',
    },
  ],
  related: ['http-status', 'cache-headers', 'http-header-analyzer'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
