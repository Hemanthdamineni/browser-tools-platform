import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'strftime',
  name: 'strftime Formatter',
  category: 'datetime',
  summary:
    'Format a timestamp with strftime tokens — %Y-%m-%d, %H:%M:%S, %j, %U, %s and more — in your local time or UTC.',
  description:
    'Apply a strftime-style format string to a date: %Y (year), %m (month), %d (day), %H:%M:%S (clock), %j (day of year), %U/%W (week number), %a/%A and %b/%B (names), %p (AM/PM), %s (Unix epoch), %z/%Z (timezone) and composite shorthand %F, %D, %R, %T, %x, %X. Defaults to the current time, or give a Unix timestamp; format in your local time or UTC. Unknown tokens are kept as-is and flagged. 100% on-device.',
  keywords: [
    'strftime',
    'date format string',
    'format timestamp',
    'strftime tokens',
    'date time formatting',
    'unix timestamp format',
    'strftime reference',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'at',
      label: 'Unix timestamp (empty = now)',
      type: 'number',
      default: -1,
      min: -1,
    },
    {
      key: 'utc',
      label: 'Use UTC',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'A common format',
      input: '%Y-%m-%d %H:%M:%S',
      options: { at: 0 },
    },
    {
      title: 'ISO date and time with a zone offset',
      input: '%F %T %z',
      options: { at: 1700000000, utc: true },
    },
    {
      title: 'Weekday, day of year and week number',
      input: '%A, day %j, week %W',
      options: { at: 1700000000, utc: true },
    },
  ],
  related: ['timestamp', 'timezone-convert', 'date-add', 'date-diff'],
  status: 'stable',
};
