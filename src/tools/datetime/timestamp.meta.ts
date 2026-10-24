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
  article: [
    {
      heading: 'Two directions, one box',
      body: 'Type a Unix timestamp — seconds or milliseconds — or any parseable date string and the tool converts between them. A numeric input is treated as an epoch value; anything else is handed to the browser’s date parser. The output mode “All formats” returns a table of Unix seconds, Unix milliseconds, ISO 8601, RFC 2822, RFC 3339, the day of the week and a relative phrase like “3 days ago”.',
    },
    {
      heading: 'Choosing the unit and timezone',
      body: 'Auto-detect treats values up to 100 billion in magnitude as seconds and larger values as milliseconds, which keeps a modern timestamp from being read as a date in 1970. If a value sits on the boundary and is misread, force Seconds or Milliseconds. The display timezone picks between UTC (ISO 8601 with a Z, and RFC 2822 in GMT) and your machine’s local zone with a proper offset.',
    },
    {
      heading: 'Narrowing the output',
      body: 'If you only need one value, set Output to ISO 8601, RFC 2822, Relative or Unix seconds and you get a single string instead of the full table — handy when copying straight into a script or a header. Relative output measures from the moment you run the tool, so a future date reads “in 2 hours” and a past one reads “2 hours ago”.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'Date-only strings are interpreted by the browser, whose rules follow the ECMAScript date-time format rather than any server’s locale, so an ambiguous string like 01/02/2024 can differ by region — prefer an explicit ISO form. There is no lookup and no clock sync: everything is computed in the page, offline, and nothing you type is uploaded.',
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
    {
      q: 'Why can a date-only string such as 01/02/2024 be read differently by region?',
      a: 'Non-numeric input is parsed by the browser, whose rules follow the ECMAScript date-time format rather than any server locale. Use an explicit form like 2024-02-01T00:00:00Z to avoid ambiguity.',
    },
  ],
  related: ['timezone-convert', 'date-diff', 'duration-convert', 'cron-parser'],
  status: 'stable',
};
