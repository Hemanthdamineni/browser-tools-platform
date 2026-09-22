import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'timestamp',
  name: 'Unix Timestamp Converter',
  category: 'datetime',
  summary: 'Convert Unix timestamps to dates and dates to every common timestamp format.',
  description:
    'Turn a Unix timestamp (seconds or milliseconds, auto-detected) or any human-readable date into ISO 8601, RFC 2822, RFC 3339, relative time and raw epoch values — shown in UTC or your local timezone.',
  keywords: [
    'unix timestamp',
    'epoch converter',
    'epoch',
    'iso 8601',
    'rfc 2822',
    'date converter',
    'time converter',
    'utc',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'unit',
      label: 'Timestamp unit',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'seconds', label: 'Seconds' },
        { value: 'milliseconds', label: 'Milliseconds' },
      ],
    },
    {
      key: 'timezone',
      label: 'Display timezone',
      type: 'select',
      default: 'utc',
      choices: [
        { value: 'utc', label: 'UTC' },
        { value: 'local', label: 'Local' },
      ],
    },
    {
      key: 'output',
      label: 'Output',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'All formats' },
        { value: 'iso', label: 'ISO 8601' },
        { value: 'rfc2822', label: 'RFC 2822' },
        { value: 'relative', label: 'Relative' },
        { value: 'epoch', label: 'Unix seconds' },
      ],
    },
  ],
  examples: [
    { title: 'A timestamp', input: '1700000000' },
    { title: 'A date', input: '2024-02-29T00:00:00Z' },
    { title: 'Now' },
  ],
  faq: [
    {
      q: 'How does auto-detect tell seconds from milliseconds?',
      a: 'Timestamps up to 100 billion in magnitude are treated as seconds (dates until the year 5138); anything larger is treated as milliseconds. Force the unit with the option if a value is misread.',
    },
    {
      q: 'Does anything leave my browser?',
      a: 'No. All conversion happens on-device and works fully offline.',
    },
  ],
  related: ['timezone-convert', 'date-diff', 'duration-convert', 'cron-parser'],
  status: 'stable',
};
