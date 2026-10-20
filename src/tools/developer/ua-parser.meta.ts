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
  related: ['diff-text', 'http-status', 'regex-tester', 'port-lookup'],
  status: 'stable',
};
