import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'user-agent',
  name: 'User-Agent Parser',
  category: 'web',
  summary: 'Break a User-Agent string into browser, version, OS, engine and device type.',
  description:
    'Paste any User-Agent string to identify the browser and version, operating system and version, rendering engine, device type and whether it is a bot or crawler. Uses a heuristic regex parser — no network lookup, everything on-device.',
  keywords: [
    'user agent',
    'user-agent parser',
    'parse user agent',
    'browser detection',
    'os detection',
    'crawler detection',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'Chrome on Windows',
      input:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    { title: 'curl', input: 'curl/8.4.0' },
    {
      title: 'Mobile Safari on an iPhone',
      input:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    },
  ],
  related: ['http-status', 'ip-address-inspector'],
  status: 'stable',
};
