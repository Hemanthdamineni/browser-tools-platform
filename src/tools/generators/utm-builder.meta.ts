import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'utm-builder',
  name: 'UTM Campaign URL Builder',
  category: 'generators',
  summary: 'Add utm_source, utm_medium, utm_campaign and more tracking parameters to any URL.',
  description:
    'Build campaign-tagged links for Google Analytics and other trackers. Choose which UTM parameters to set, optionally lowercase everything, and get the final URL plus a readable breakdown.',
  keywords: [
    'utm',
    'utm builder',
    'campaign url',
    'google analytics',
    'tracking url',
    'marketing link',
    'utm parameters',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'source', label: 'utm_source (referral, e.g. newsletter)', type: 'text', default: '' },
    {
      key: 'medium',
      label: 'utm_medium (marketing medium, e.g. email)',
      type: 'text',
      default: '',
    },
    { key: 'campaign', label: 'utm_campaign (campaign name)', type: 'text', default: '' },
    { key: 'term', label: 'utm_term (paid keywords)', type: 'text', default: '' },
    { key: 'content', label: 'utm_content (A/B variant)', type: 'text', default: '' },
    { key: 'lowercase', label: 'Force lowercase values', type: 'boolean', default: false },
    {
      key: 'stripExisting',
      label: 'Replace existing utm_* parameters',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Email newsletter link',
      input: 'https://example.com/p',
      options: { source: 'newsletter', medium: 'email', campaign: 'spring' },
    },
    {
      title: 'Social post',
      input: 'https://example.com/p',
      options: { source: 'twitter', medium: 'social', campaign: 'launch-day' },
    },
  ],
  faq: [
    {
      q: 'Which parameters should I always set?',
      a: 'Google recommends utm_source, utm_medium and utm_campaign as a minimum — the tool warns if any of the three is missing.',
    },
    {
      q: 'Do UTM parameters affect SEO?',
      a: 'Tagged URLs are treated as separate addresses by analytics, but search engines canonicalise them away. Use them in campaigns, not in your internal links.',
    },
  ],
  related: [  "url-parse",
  "querystring"],
  status: 'stable',
};
