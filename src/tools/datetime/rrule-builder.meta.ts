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
  article: [
    {
      heading: 'What the builder produces',
      body: 'Filling in the form assembles one RFC 5545 RRULE line, the string that goes inside a VEVENT to say how an event repeats. It always starts with FREQ and adds INTERVAL only when the repeat is not every period, BYDAY for weekly rules, BYMONTHDAY for monthly ones, and at most one of COUNT or UNTIL. Alongside the rule the notes carry a plain-English reading of it — "Repeats every 2 weeks on Monday, Wednesday" — so you can check the grammar without decoding the codes. The output downloads as recurrence-rule.txt.',
    },
    {
      heading: 'Weekly rules and BYDAY',
      body: 'Weekday selection is only meaningful for a weekly frequency, and using it on a daily or monthly rule is rejected rather than quietly ignored. Enter the codes MO through SU separated by commas or spaces; case does not matter, the list is normalised into calendar order, and a repeated day is an error. Leave the field empty and the rule carries no BYDAY at all, which means the event simply repeats on whatever weekday DTSTART names — the notes state that explicitly so the result is never ambiguous.',
    },
    {
      heading: 'Count, end date and awkward month days',
      body: 'A rule may end by counting occurrences or by reaching a date, never both, and the builder refuses the combination. A count of zero means no COUNT part is emitted, leaving the rule open-ended; otherwise the count is written as-is. An end date must be a real calendar date in YYYY-MM-DD form and is emitted as a UTC date-time on the final second of that day, so the last day itself is included. For monthly rules, choosing a day of 29 or later adds a warning, because months without that day simply produce no occurrence.',
    },
    {
      heading: 'What it does not do',
      body: 'The result is a single recurrence rule, not a complete calendar entry: there is no DTSTART, no timezone parameter, no EXDATE to skip individual dates, and no BYSETPOS for things like the last Friday of the month. Those belong in the surrounding VEVENT, where DTSTART defines the first occurrence the rule counts from. Validation happens as you build, and the errors name the field at fault, such as an out-of-range interval or a weekday given for a monthly rule. Everything is computed on your device — no rule you type is transmitted anywhere.',
    },
  ],
  related: ['ical-event', 'cron-parser', 'date-add'],
  status: 'stable',
};
