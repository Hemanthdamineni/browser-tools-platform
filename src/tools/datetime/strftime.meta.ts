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
  ],
  faq: [
    {
      q: 'Which strftime tokens are supported?',
      a: 'Year (%Y %y), month (%m, %b, %B), day (%d, %e, %j), weekday (%a, %A, %w, %u), hour (%H, %I, %p, %P), minute/second (%M %S), week numbers (%U Sunday-based, %W Monday-based), Unix time (%s) and zone (%z, %Z). Composite shorthands %c, %D, %F, %R, %T, %x, %X are expanded, and %% is a literal percent.',
    },
    {
      q: 'What happens to an unknown token?',
      a: 'It is left exactly as written (e.g. "%q" stays "%q") and listed in the notes so you can spot typos.',
    },
    {
      q: 'Can I format a specific past or future date?',
      a: 'Yes — put the Unix timestamp (seconds, not milliseconds) in the timestamp field. The epoch 0 formats 1970-01-01 00:00:00 UTC. Use UTC for fully deterministic output.',
    },
  ],
  related: ['timestamp', 'timezone-convert', 'date-add', 'date-diff'],
  status: 'stable',
};
