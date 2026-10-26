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
  related: ['security-headers', 'cors-headers', 'http-status'],
  status: 'stable',
};
