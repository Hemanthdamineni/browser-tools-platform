import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'referrer-policy',
  name: 'Referrer-Policy Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect referrer information controls.',
  description:
    'Generate or analyze Referrer-Policy response values. Validates all supported policy tokens, explains how a comma-separated list resolves to the last supported token, and flags unsafe-url and downgrade-leakage risks locally.',
  keywords: [
    'Referrer-Policy',
    'HTTP referrer',
    'no-referrer',
    'strict-origin-when-cross-origin',
    'referrer leakage',
    'downgrade referrer',
    'privacy header',
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
        { value: 'analyze', label: 'Analyze policy' },
        { value: 'build', label: 'Build policy' },
      ],
    },
    {
      key: 'value',
      label: 'Policy',
      type: 'select',
      default: 'strict-origin-when-cross-origin',
      choices: [
        { value: 'no-referrer', label: 'no-referrer' },
        { value: 'no-referrer-when-downgrade', label: 'no-referrer-when-downgrade' },
        { value: 'origin', label: 'origin' },
        { value: 'origin-when-cross-origin', label: 'origin-when-cross-origin' },
        { value: 'same-origin', label: 'same-origin' },
        { value: 'strict-origin', label: 'strict-origin' },
        { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin' },
        { value: 'unsafe-url', label: 'unsafe-url' },
      ],
    },
  ],
  article: [
    {
      heading: 'Building or dissecting the header',
      body: 'Build mode turns the chosen policy token into a usable Referrer-Policy value and reports how many tokens it contains and which one is effective. Analyze mode takes a pasted value — including a comma-separated fallback list — and returns a table of Policy, Status (Valid or Invalid) and Behaviour for each token, with its issues in the notes.',
    },
    {
      heading: 'Auditing how much URL you leak',
      body: 'Use it when you are adding security headers and want to know exactly which Referer a browser will send in each case, when a third-party analytics vendor needs more referrer detail than your current policy allows, or when a penetration-test report flags referrer leakage and you need the tightest policy that still works.',
    },
    {
      heading: 'Options',
      body: 'Mode picks analyze or build, and Policy selects one of the eight standard tokens for build mode. Build mode refuses to emit a value it would itself flag, so unsafe-url cannot be produced through the builder without the tool telling you why it is risky.',
    },
    {
      heading: 'What the checks look for',
      body: 'Unknown tokens are marked Invalid, duplicates are called out, unsafe-url is flagged because it sends full URLs cross-origin, and no-referrer-when-downgrade is flagged as the legacy default that leaks more than modern policies. The effective token is the last one a browser recognises. The tool explains the header but never fetches your site.',
    },
    {
      heading: 'Analysed in your tab',
      body: 'The value is parsed locally and nothing is uploaded, so you can check a header from an internal or pre-release site without exposing it. It works offline.',
    },
  ],
  examples: [
    { title: 'Analyze a policy', input: 'strict-origin-when-cross-origin' },
    { title: 'Build a strict policy', options: { mode: 'build', value: 'no-referrer' } },
    { title: 'Spot a risky fallback list', input: 'no-referrer, unsafe-url' },
  ],
  faq: [
    {
      q: 'What is the recommended default?',
      a: 'strict-origin-when-cross-origin is the common recommendation: it sends origins on cross-origin requests and full URLs same-origin.',
    },
    {
      q: 'Why list multiple policies?',
      a: 'The browser applies the last supported token, so a list can express a preferred policy with fallbacks for older browsers.',
    },
    {
      q: 'Why is unsafe-url risky?',
      a: 'It sends full URLs, potentially including paths, queries, or tokens, on cross-origin requests.',
    },
  ],
  related: ['security-headers', 'cross-origin-opener-policy', 'permissions-policy'],
  status: 'stable',
};
