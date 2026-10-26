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
  related: ['diff-text', 'http-status', 'regex-tester', 'port-lookup'],
  status: 'stable',
};
