import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ua-parser',
  name: 'User-Agent Parser',
  category: 'developer',
  summary:
    'Decode any User-Agent string into browser, version, engine, OS, OS version and device class — on your device.',
  description:
    'Paste a User-Agent string from a log, analytics hit or request header and get back a clean breakdown: browser name and version, rendering engine (Blink, Gecko, WebKit…), operating system and version, and whether the client is a desktop, mobile, tablet or bot. Covers Chrome, Firefox, Safari, Edge, Opera, Samsung Internet and more across Windows, macOS, Linux, Android and iOS.',
  keywords: [
    'user agent parser',
    'ua parser',
    'parse user agent',
    'browser detection',
    'what browser',
    'user agent string decode',
    'ua lookup',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'A Chrome on Windows UA',
      input:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    {
      title: 'An iPhone Safari UA',
      input:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    },
    {
      title: 'A search crawler UA',
      input: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  ],
  faq: [
    {
      q: 'Which browsers are recognized?',
      a: 'Chrome, Firefox, Safari, Edge, Opera (and Opera GX), Samsung Internet, plus search/bot crawlers like Googlebot and Bingbot via keyword detection.',
    },
    {
      q: 'Is this an exhaustive lookup?',
      a: 'No. A User-Agent is a string, not a contract — detection is heuristic by design. Real products behave correctly for the common UAs this tool targets, and listed rules cover the mainstream long tail.',
    },
    {
      q: 'How is my data used?',
      a: 'This parser runs entirely in your browser. The string never leaves your device.',
    },
  ],
  article: [
    {
      heading: 'What the decoded row set tells you',
      body: 'One User-Agent string becomes a six-row table: browser, browser version, rendering engine, operating system, OS version and device class. The device class distinguishes desktop, mobile, tablet and bot, and engine names such as Blink, WebKit, Gecko, Trident and EdgeHTML are reported from the token the string actually carries rather than from the browser name.',
    },
    {
      heading: 'Why the order of checks matters',
      body: 'Many browsers embed other products names for compatibility, so the parser tests in a deliberate order — Samsung Internet, then Edge variants, then Opera, then Chrome, Firefox, Safari — because a Chrome string also contains "Safari" and an Edge string contains "Chrome". Crawlers are detected first, with keyword matching for bot, spider or crawler tokens, because they rarely carry a browser token at all.',
    },
    {
      heading: 'Where the answer can be wrong',
      body: 'A User-Agent is self-reported text, not a contract: browsers freeze version numbers for privacy, extensions rewrite strings, and new products appear constantly. Detection is heuristic, so treat the result as a strong hint. Strings the rules do not recognise are shown as Unknown rather than being mapped to a neighbouring browser by guesswork.',
    },
    {
      heading: 'Nothing is looked up online',
      body: 'All matching happens against built-in rules in this page. The string is analysed locally, no request is sent to a device-detection service, and pasting a log line therefore reveals nothing about your traffic to a third party.',
    },
  ],
  related: ['diff-text', 'http-status', 'regex-tester', 'port-lookup'],
  status: 'stable',
};
