import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'crontab-generator',
  name: 'Crontab Generator',
  category: 'developer',
  summary:
    'Build a cron expression from presets or fields and get the crontab line plus a plain-English summary.',
  description:
    'Compose a cron schedule without memorizing the syntax: pick a preset (every minute, every 5/15 minutes, hourly, daily, weekly, monthly) or fill the five fields by hand — minute, hour, day-of-month, month, day-of-week — with ranges, steps, lists and weekday/month names supported. The tool validates every field, renders the crontab line (optionally with a command), and explains the schedule in plain English. Pair with cron-parser for next-run times.',
  keywords: [
    'cron generator',
    'crontab line generator',
    'cron expression builder',
    'schedule crontab',
    'cron syntax help',
    'every minute cron',
    'cron job generator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'preset',
      label: 'Preset',
      type: 'select',
      choices: [
        { value: 'every-minute', label: 'Every minute' },
        { value: 'every-5-minutes', label: 'Every 5 minutes' },
        { value: 'every-15-minutes', label: 'Every 15 minutes' },
        { value: 'hourly', label: 'Hourly' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'custom', label: 'Custom fields' },
      ],
      default: 'every-minute',
    },
    {
      key: 'hour',
      label: 'Hour (0–23)',
      type: 'number',
      default: 9,
      min: 0,
      max: 23,
    },
    {
      key: 'minute',
      label: 'Minute (0–59)',
      type: 'number',
      default: 0,
      min: 0,
      max: 59,
    },
    {
      key: 'dayOfWeek',
      label: 'Day of week (0=Sun … 6=Sat)',
      type: 'select',
      choices: ['0', '1', '2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v })),
      default: '1',
    },
    {
      key: 'dayOfMonth',
      label: 'Day of month (1–31)',
      type: 'number',
      default: 1,
      min: 1,
      max: 31,
    },
    {
      key: 'minuteField',
      label: 'Custom minute field',
      type: 'text',
      default: '',
      placeholder: '*/15',
    },
    {
      key: 'hourField',
      label: 'Custom hour field',
      type: 'text',
      default: '',
      placeholder: '9-17',
    },
    {
      key: 'dayOfMonthField',
      label: 'Custom day-of-month field',
      type: 'text',
      default: '',
      placeholder: '1,15',
    },
    {
      key: 'monthField',
      label: 'Custom month field',
      type: 'text',
      default: '',
      placeholder: 'JAN-AUG',
    },
    {
      key: 'dayOfWeekField',
      label: 'Custom day-of-week field',
      type: 'text',
      default: '',
      placeholder: 'MON-FRI',
    },
    {
      key: 'command',
      label: 'Command (optional, appended)',
      type: 'text',
      default: '',
      placeholder: '/usr/bin/example',
    },
  ],
  article: [
    {
      heading: 'Presets or five fields',
      body: 'Pick a preset — every minute, every 5 or 15 minutes, hourly, daily, weekly or monthly — and the tool fills the classic five cron fields (minute, hour, day-of-month, month, day-of-week) for you. Choose “Custom fields” to type each field yourself. Either way you get the finished crontab line, optionally with a command appended after it, plus a plain-English sentence describing the schedule.',
    },
    {
      heading: 'Ranges, steps, lists and names',
      body: 'The custom fields accept everything a real crontab does: a list (1,15), a range (9-17), a step (*/5), and combined forms like 9-17/2. Month and weekday names are understood — JAN-AUG, MON-FRI — in either the custom fields or the value pickers, and each field is validated against its own legal range before anything is emitted, so a typo like 25 in the hour field is reported instead of silently producing a job that never runs.',
    },
    {
      heading: 'Why the English summary matters',
      body: 'Cron is notorious for quietly doing something other than you pictured — a weekly job that also fires because day-of-month was left at a value, or a step that skips an hour you cared about. The summary line restates the schedule in words so you can confirm intent before pasting the line into a crontab or a CI config, and it pairs well with cron-parser when you want the next run times.',
    },
    {
      heading: 'Scope and privacy',
      body: 'The generator describes schedules only; it does not run, schedule or contact anything, and it does not expand a job to individual fire times. Everything is computed locally from your inputs with no request or upload, so the page works offline and your commands and paths stay on your device.',
    },
  ],
  examples: [
    {
      title: 'Daily at 09:00',
      input: '',
      options: { preset: 'daily', hour: 9, minute: 0 },
    },
    {
      title: 'Every 15 minutes with a command',
      input: '',
      options: { preset: 'every-15-minutes', command: '/usr/bin/example' },
    },
    {
      title: 'Custom: weekdays at 9–17',
      input: '',
      options: {
        preset: 'custom',
        minuteField: '0',
        hourField: '9-17',
        dayOfWeekField: 'MON-FRI',
      },
    },
  ],
  faq: [
    {
      q: 'What do the five fields mean?',
      a: 'minute hour day-of-month month day-of-week. Steps, ranges and lists work: */5, 9-17, 1,15, MON-FRI, JAN. The tool validates them and flags bad input.',
    },
    {
      q: 'How do "every minute" and "hourly" differ?',
      a: 'Every minute is * * * * *; every 5 minutes is */5 * * * *; hourly at minute m is m * * * *. Presets set these for you, and custom lets you tweak any field directly.',
    },
    {
      q: 'Why show a summary?',
      a: 'Cron syntax is easy to tie in knots. The plain-English summary confirms what you actually scheduled before you save it, complementing cron-parser for next-run times.',
    },
  ],
  related: ['cron-parser', 'recurrence-dates', 'timestamp', 'timezone-convert'],
  status: 'stable',
};
