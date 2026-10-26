import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'retry-after',
  name: 'Retry-After Header Builder & Parser',
  category: 'web',
  summary: 'Build or inspect Retry-After headers using seconds or an HTTP date.',
  description:
    'Generate a Retry-After response header from a delay or UTC date, or parse pasted values to identify delta-seconds and HTTP-date forms. All processing is local and no clock or network data is sent anywhere.',
  keywords: [
    'retry-after',
    'HTTP retry header',
    'rate limit retry',
    '429 retry',
    '503 retry',
    'delta-seconds',
    'HTTP date parser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Parse values' },
        { value: 'build', label: 'Build value' },
      ],
    },
    { key: 'seconds', label: 'Delay seconds', type: 'number', default: 60, min: 0 },
    { key: 'date', label: 'HTTP date (optional)', type: 'text', default: '' },
    {
      key: 'form',
      label: 'Output form',
      type: 'select',
      default: 'seconds',
      choices: [
        { value: 'seconds', label: 'delta-seconds' },
        { value: 'date', label: 'HTTP-date' },
      ],
    },
  ],
  examples: [
    { title: 'Parse rate-limit response', input: '120' },
    {
      title: 'Build a 60-second retry delay',
      options: { mode: 'build', seconds: 60, form: 'seconds' },
    },
    {
      title: 'Build an HTTP-date retry value',
      options: { mode: 'build', form: 'date', date: 'Wed, 21 Oct 2015 07:28:00 GMT' },
    },
  ],
  related: ['http-status', 'cache-headers', 'timestamp'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
