import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'recurrence-dates',
  name: 'Recurrence Dates Calculator',
  category: 'datetime',
  summary: 'List the next upcoming dates for a weekly, monthly, or yearly repeating schedule.',
  description: 'Give it a start date and a repeating pattern (every N weeks on chosen weekdays, a fixed calendar day each month, the 2nd Tuesday of each month, or the same date yearly) and it lists the next real calendar dates — with the correct weekday — up to a count you choose. Short months and leap years are handled: missing days either clamp to the last day of the month or skip the month, as you prefer. No iCalendar file required; this computes dates directly, on-device.',
  keywords: ['recurrence', 'recurring dates', 'next occurrence', 'billing schedule', 'payday calculator', '2nd Tuesday', 'every other week', 'monthly schedule', 'event repeats', 'recurring calendar'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Pattern', type: 'select', default: 'monthly-day', choices: [{ value: 'monthly-day', label: 'Monthly — same day each month' }, { value: 'monthly-nth', label: 'Monthly — Nth weekday of month' }, { value: 'weekly', label: 'Weekly — chosen weekday(s)' }, { value: 'yearly', label: 'Yearly — same date each year' }] },
    { key: 'nth', label: 'Nth occurrence', type: 'select', default: '1', choices: [{ value: '1', label: '1st' }, { value: '2', label: '2nd' }, { value: '3', label: '3rd' }, { value: '4', label: '4th' }, { value: 'last', label: 'Last' }] },
    { key: 'weekday', label: 'Weekday', type: 'select', default: 'auto', choices: [{ value: 'auto', label: 'Same as start date' }, { value: 'mon', label: 'Monday' }, { value: 'tue', label: 'Tuesday' }, { value: 'wed', label: 'Wednesday' }, { value: 'thu', label: 'Thursday' }, { value: 'fri', label: 'Friday' }, { value: 'sat', label: 'Saturday' }, { value: 'sun', label: 'Sunday' }] },
    { key: 'count', label: 'Occurrences', type: 'number', default: 6, min: 1, max: 50, step: 1 },
    { key: 'interval', label: 'Interval (skip count)', type: 'number', default: 1, min: 1, max: 12, step: 1 },
    { key: 'clamp', label: 'Clamp short months', type: 'boolean', default: true },
  ],
  examples: [
    { title: 'Payday — every other week', input: '2026-01-02', options: { mode: 'weekly', weekday: 'fri', interval: 2, count: 6 } },
    { title: 'Meeting — 2nd Tuesday monthly', input: '2026-01-01', options: { mode: 'monthly-nth', nth: '2', weekday: 'tue', count: 6 } },
  ],
  faq: [
    { q: 'How do I input the start date?', a: 'Paste a single date in YYYY-MM-DD form, for example 2026-10-18. Alternative formats like 18/10/2026 are recognised when the numbers are unambiguous.' },
    { q: 'What happens on the 31st in a 30-day month?', a: 'With clamping on (default) the date rolls to the last day of that month, like real calendar software. With clamping off, short months are skipped and the 31st only appears in months that have one.' },
    { q: 'How is leap day February 29 handled?', a: 'With a yearly pattern, clamping rolls it to February 28 in non-leap years; without clamping it only occurs in leap years.' },
    { q: 'Does this build an iCalendar rule?', a: 'No — it computes the concrete next dates directly. If you need an RRULE string, use the iCalendar Recurrence Rule Builder instead.' },
  ],
  related: ['rrule-builder', 'date-add', 'timestamp', 'week-number'],
  status: 'stable',
};
