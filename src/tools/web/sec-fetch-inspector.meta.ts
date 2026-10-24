import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sec-fetch-inspector',
  name: 'Sec-Fetch Request Inspector',
  category: 'web',
  summary: 'Inspect fetch metadata for cross-site requests.',
  description:
    'Analyze the Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest, and Sec-Fetch-User request headers. Validates defined values, flags suspicious or impossible combinations, and explains how fetch metadata helps detect cross-site request forgery.',
  keywords: [
    'Sec-Fetch-Site',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Dest',
    'Sec-Fetch-User',
    'fetch metadata',
    'cross-site request forgery',
    'request context headers',
    'CSRF',
    'browser security',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'Analyze a navigation request',
      input: 'Sec-Fetch-Site: same-origin\nSec-Fetch-Mode: navigate\nSec-Fetch-Dest: document',
    },
    {
      title: 'Inspect a form post',
      input: 'Sec-Fetch-Site: same-site\nSec-Fetch-Mode: navigate\nSec-Fetch-User: ?1',
    },
    {
      title: 'A cross-site fetch with an invalid value',
      input: 'Sec-Fetch-Site: cross-site\nSec-Fetch-Mode: cors\nSec-Fetch-Dest: script',
    },
  ],
  article: [
    {
      heading: 'Four headers that describe intent',
      body: 'Sec-Fetch-Site says how the request relates to the page that made it — cross-site, same-site, same-origin or none. Sec-Fetch-Mode distinguishes a navigation from a CORS, no-cors, same-origin or WebSocket request. Sec-Fetch-Dest names what the response is for, such as document, script, style, image or iframe. Sec-Fetch-User is ?1 when a navigation was triggered by a real user action.',
    },
    {
      heading: 'Why that helps against CSRF',
      body: 'A cross-site request forgery works because the browser attaches the victim’s cookies to a request another site caused. Fetch metadata lets the server ask "did the user actually mean to trigger this?", the exact question CSRF exploits cannot answer. Rejecting a cross-site navigation that carries state-changing parameters, or requiring Sec-Fetch-User on top-level navigations, closes off whole classes of attack.',
    },
    {
      heading: 'What the inspector reports',
      body: 'Paste the header lines and each one becomes a row with its value and a plain-English assessment. Values outside the defined set are flagged — a sec-fetch-user that is not ?0 or ?1, a mode or destination the specification does not list — and a cross-site top-level navigation is called out so you can check it against the traffic you expect. Duplicates and malformed lines are reported too.',
    },
    {
      heading: 'Why these headers are trustworthy',
      body: 'A script cannot set them: they are on the forbidden header list, so page JavaScript has no way to spoil the signal, and the values are attached by the browser itself. That makes them a useful defense-in-depth layer — but they are not a replacement for authentication and authorization. If no Sec-Fetch headers are present at all, the request likely came from a non-browser client.',
    },
    {
      heading: 'Analyzed locally',
      body: 'The parse and the assessment happen in this tab with no request and no lookup table fetched from a server. Header values copied out of a proxy log can be pasted in safely, and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'What are Sec-Fetch headers?',
      a: 'These request headers describe the request context (site relationship, mode, destination, and user activation) that the browser attaches to a request.',
    },
    {
      q: 'How does fetch metadata help security?',
      a: 'Because these headers are set by the browser and describe intent, servers can use them as a defense-in-depth signal against cross-site request forgery.',
    },
    {
      q: 'Can an attacker forge them?',
      a: 'They cannot be set by scripts due to their forbidden-header status, which is what makes them a trustworthy signal.',
    },
  ],
  related: ['security-headers', 'cors-headers', 'http-status'],
  status: 'stable',
};
