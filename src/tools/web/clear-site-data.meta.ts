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
    { title: 'Check the wildcard for redundancy', input: '"*", "cookies"' },
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
  article: [
    {
      heading: 'What the Clear-Site-Data analyser reports',
      body: 'Paste quoted targets such as "cookies", "storage" and "cache" and the analyser returns a table with each target, a Valid or Invalid verdict and the scope it wipes. Build mode takes the same comma-separated list, checks it and prints the joined header value ready to copy into a response.',
    },
    {
      heading: 'Planning what a logout should clear',
      body: 'This is for the response that follows a sign-out or account reset, where the browser should drop stored data instead of leaving a half-authenticated session behind. Cookies and storage cover the usual case; add cache when a service worker or cached HTML would otherwise resurface.',
    },
    {
      heading: 'Quoting, duplicates and the wildcard',
      body: 'Targets are compared case-insensitively against a fixed set, so an unquoted cookies is reported as invalid. Duplicate entries are flagged, and pairing the * wildcard with another target is called out as redundant because the wildcard already requests every supported type. Build mode refuses an empty list.',
    },
    {
      heading: 'What the browser will actually do',
      body: 'The header is honoured only on secure responses, and it affects the origin that sent it rather than third-party data. A target the browser does not implement may simply be ignored, which is why unsupported names are marked Invalid instead of being guessed at.',
    },
    {
      heading: 'Parsed inside this tab',
      body: 'The splitter and validator are plain page code: the header text you paste is inspected in the browser and never sent to a server, and the tool works with the network disabled.',
    },
  ],
  related: ['security-headers', 'set-cookie', 'origin-agent-cluster'],
  status: 'stable',
};
