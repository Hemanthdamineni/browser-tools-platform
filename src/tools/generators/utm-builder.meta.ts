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
  article: [
    {
      heading: 'What it does',
      body: 'Enter a full URL and fill any of the five UTM fields — source, medium, campaign, term, content — and the tool returns the tagged URL followed by a plain breakdown listing each parameter it set.',
    },
    {
      heading: 'A concrete use',
      body: 'Tagging a newsletter link with source=newsletter, medium=email and campaign=spring so analytics can tell that traffic apart from search.',
    },
    {
      heading: 'How the options behave',
      body: 'lowercase forces every value you supply to lower case, which matters because analytics treat Email and email as different mediums. stripExisting removes any utm_* parameters already on the URL before adding yours; turn it off and the tool appends your values alongside existing ones. If source, medium or campaign is empty, a warning names exactly which are missing.',
    },
    {
      heading: 'Limits to know',
      body: 'The input must parse as a URL with a scheme, so a bare example.com path is rejected with the hint to add https://. Empty input returns an empty result rather than an error. Stripping matches any parameter whose name starts with utm_ ignoring case, so utm_custom is removed too.',
    },
    {
      heading: 'Privacy',
      body: 'The URL and its parameters are assembled in your browser — no request is made to the destination or anywhere else.',
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
    {
      title: 'Replace existing tags',
      input: 'https://example.com/p?utm_source=old',
      options: { campaign: 'relaunch', stripExisting: true },
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
    {
      q: 'What happens if the URL already has UTM parameters?',
      a: 'With Replace existing utm_* parameters on (the default) every utm_ parameter already on the URL is deleted first, whatever its case, so no stale tags survive. Turn it off and your values are appended next to the existing ones instead of overwriting them.',
    },
  ],
  related: ['url-parse', 'querystring'],
  status: 'stable',
};
