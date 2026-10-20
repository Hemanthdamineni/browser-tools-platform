import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'rrule-builder',
  name: 'iCalendar Recurrence Rule Builder',
  category: 'datetime',
  summary: 'Build and validate RFC 5545 RRULE recurrence strings for calendar events.',
  description:
    'Create an iCalendar recurrence rule for daily, weekly, monthly, or yearly events. Configure interval, weekdays, month day, occurrence count, or end date; get a copyable RRULE line and a concise explanation.',
  keywords: [
    'rrule',
    'recurrence rule',
    'icalendar recurrence',
    'rfc 5545',
    'calendar repeat',
    'ics recurrence',
    'recurring event',
    'byday',
    'freq',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'frequency',
      label: 'Frequency',
      type: 'select',
      default: 'WEEKLY',
      choices: [
        { value: 'DAILY', label: 'Daily' },
        { value: 'WEEKLY', label: 'Weekly' },
        { value: 'MONTHLY', label: 'Monthly' },
        { value: 'YEARLY', label: 'Yearly' },
      ],
    },
    {
      key: 'interval',
      label: 'Repeat every N periods',
      type: 'number',
      default: 1,
      min: 1,
      max: 999,
    },
    {
      key: 'weekdays',
      label: 'Weekdays (weekly rules, comma-separated MO,TU,WE,TH,FR,SA,SU)',
      type: 'text',
      default: '',
    },
    {
      key: 'monthDay',
      label: 'Day of month (monthly rules, 1–31)',
      type: 'number',
      default: 1,
      min: 1,
      max: 31,
    },
    {
      key: 'count',
      label: 'Occurrence count (leave 0 for no count)',
      type: 'number',
      default: 0,
      min: 0,
      max: 9999,
    },
    {
      key: 'until',
      label: 'End date (YYYY-MM-DD, optional)',
      type: 'text',
      default: '',
      placeholder: '2026-12-31',
    },
  ],
  examples: [
    {
      title: 'Weekdays for ten occurrences',
      options: { frequency: 'WEEKLY', weekdays: 'MO,TU,WE,TH,FR', count: 10 },
    },
    {
      title: 'Every two months on the 15th',
      options: { frequency: 'MONTHLY', interval: 2, monthDay: 15 },
    },
    { title: 'Annual event until year-end', options: { frequency: 'YEARLY', until: '2026-12-31' } },
  ],
  faq: [
    {
      q: 'How do I use the generated rule?',
      a: 'Add the RRULE line inside a VEVENT in an iCalendar file. DTSTART defines the first occurrence; the rule describes repeats relative to that event start.',
    },
    {
      q: 'Can I specify both COUNT and UNTIL?',
      a: 'No. RFC 5545 requires a recurrence rule to use at most one of COUNT or UNTIL.',
    },
    {
      q: 'Are dates timezone-aware?',
      a: 'UNTIL is emitted as a date-only value in YYYYMMDD form. For date-time DTSTART values, RFC 5545 generally requires UNTIL in UTC; use a UTC timestamp-aware calendar library for that case.',
    },
  ],
  related: ['ical-event', 'cron-parser', 'date-add'],
  status: 'stable',
};
