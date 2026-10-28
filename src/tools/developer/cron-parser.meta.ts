import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'cron-parser',
  name: 'Cron Expression Parser',
  category: 'developer',
  summary: 'Explain a cron expression in plain English and list its next run times in UTC.',
  description:
    'Paste a 5- or 6-field cron expression to get a human-readable description plus the next several run times. Supports ranges, steps, lists, month and day-of-week names, and an optional leading seconds field. All times are UTC.',
  keywords: [
    'cron',
    'crontab',
    'cron expression',
    'cron parser',
    'cron schedule',
    'next run time',
    'quartz cron',
    'cron to english',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'withSeconds',
      label: 'Expression starts with a seconds field',
      type: 'boolean',
      default: false,
      help: 'Treat a 6-field expression as "sec min hour day month weekday".',
    },
    {
      key: 'count',
      label: 'Number of upcoming runs',
      type: 'number',
      default: 5,
      min: 1,
    },
    {
      key: 'verbose',
      label: 'Verbose description',
      type: 'boolean',
      default: false,
      help: 'Ask cronstrue for a wordier sentence.',
    },
  ],
  examples: [
    { title: 'Every 5 minutes', input: '*/5 * * * *' },
    { title: 'Weekdays at 09:30 (next 3)', input: '30 9 * * MON-FRI', options: { count: 3 } },
    {
      title: 'Noon daily, with seconds field',
      input: '0 0 12 * * *',
      options: { withSeconds: true },
    },
  ],
  faq: [
    {
      q: 'Which time zone are the run times in?',
      a: 'UTC. They are computed from your device clock and printed as ISO 8601 with a trailing Z.',
    },
    {
      q: 'How is day-of-week handled?',
      a: 'Both 0 and 7 mean Sunday, and names like MON or FRI work. When day-of-month and day-of-week are both restricted, a run matches if either one matches — standard cron behavior.',
    },
    {
      q: 'What field syntax is supported?',
      a: 'Asterisk, ranges (1-5), steps (*/10 or 10-30/5), and comma lists, plus JAN–DEC and SUN–SAT names.',
    },
  ],
  related: [  "regex-tester",
  "jwt-decode",
  "uuid",
  "json-format"],
  credits: [{ name: 'cronstrue', url: 'https://github.com/bradymholt/cronstrue', license: 'MIT' }],
  status: 'stable',
};
