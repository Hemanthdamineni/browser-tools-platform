import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'recurrence-dates',
  name: 'Recurrence Dates Calculator',
  category: 'datetime',
  summary: 'List the next upcoming dates for a weekly, monthly, or yearly repeating schedule.',
  description:
    'Give it a start date and a repeating pattern (every N weeks on chosen weekdays, a fixed calendar day each month, the 2nd Tuesday of each month, or the same date yearly) and it lists the next real calendar dates — with the correct weekday — up to a count you choose. Short months and leap years are handled: missing days either clamp to the last day of the month or skip the month, as you prefer. No iCalendar file required; this computes dates directly, on-device.',
  keywords: [
    'recurrence',
    'recurring dates',
    'next occurrence',
    'billing schedule',
    'payday calculator',
    '2nd Tuesday',
    'every other week',
    'monthly schedule',
    'event repeats',
    'recurring calendar',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Pattern',
      type: 'select',
      default: 'monthly-day',
      choices: [
        { value: 'monthly-day', label: 'Monthly — same day each month' },
        { value: 'monthly-nth', label: 'Monthly — Nth weekday of month' },
        { value: 'weekly', label: 'Weekly — chosen weekday(s)' },
        { value: 'yearly', label: 'Yearly — same date each year' },
      ],
    },
    {
      key: 'nth',
      label: 'Nth occurrence',
      type: 'select',
      default: '1',
      choices: [
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' },
        { value: '3', label: '3rd' },
        { value: '4', label: '4th' },
        { value: 'last', label: 'Last' },
      ],
    },
    {
      key: 'weekday',
      label: 'Weekday',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Same as start date' },
        { value: 'mon', label: 'Monday' },
        { value: 'tue', label: 'Tuesday' },
        { value: 'wed', label: 'Wednesday' },
        { value: 'thu', label: 'Thursday' },
        { value: 'fri', label: 'Friday' },
        { value: 'sat', label: 'Saturday' },
        { value: 'sun', label: 'Sunday' },
      ],
    },
    { key: 'count', label: 'Occurrences', type: 'number', default: 6, min: 1, max: 50, step: 1 },
    {
      key: 'interval',
      label: 'Interval (skip count)',
      type: 'number',
      default: 1,
      min: 1,
      max: 12,
      step: 1,
    },
    { key: 'clamp', label: 'Clamp short months', type: 'boolean', default: true },
  ],
  examples: [
    {
      title: 'Payday — every other week',
      input: '2026-01-02',
      options: { mode: 'weekly', weekday: 'fri', interval: 2, count: 6 },
    },
    {
      title: 'Meeting — 2nd Tuesday monthly',
      input: '2026-01-01',
      options: { mode: 'monthly-nth', nth: '2', weekday: 'tue', count: 6 },
    },
    {
      title: 'Monthly on the 31st, short months clamped',
      input: '2026-01-31',
      options: { mode: 'monthly-day', count: 6 },
    },
  ],
  faq: [
    {
      q: 'How do I input the start date?',
      a: 'Paste a single date in YYYY-MM-DD form, for example 2026-10-18. Alternative formats like 18/10/2026 are recognised when the numbers are unambiguous.',
    },
    {
      q: 'What happens on the 31st in a 30-day month?',
      a: 'With clamping on (default) the date rolls to the last day of that month, like real calendar software. With clamping off, short months are skipped and the 31st only appears in months that have one.',
    },
    {
      q: 'How is leap day February 29 handled?',
      a: 'With a yearly pattern, clamping rolls it to February 28 in non-leap years; without clamping it only occurs in leap years.',
    },
    {
      q: 'Does this build an iCalendar rule?',
      a: 'No — it computes the concrete next dates directly. If you need an RRULE string, use the iCalendar Recurrence Rule Builder instead.',
    },
  ],
  article: [
    {
      heading: 'Concrete dates rather than a rule string',
      body: 'Give a start date as YYYY-MM-DD and the tool lists the upcoming dates the pattern really lands on, each with its weekday, as a numbered table of date and occurrence. Patterns cover a fixed day each month, the Nth or last weekday of a month, chosen weekdays every N weeks, and the same date each year.',
    },
    {
      heading: 'Where upcoming dates are useful',
      body: 'It is handy for listing paydays on a fortnightly cycle, working out when the second Tuesday meeting falls, or checking that a yearly renewal never lands on a weekend.',
    },
    {
      heading: 'Options that shape the list',
      body: 'Occurrences sets how many dates are shown and is held between 1 and 50. Interval is the skip count, up to 12, so weekly with interval 2 means every other week. Weekday selects the day, with auto reusing the start date weekday, and Nth is read only by the recurring weekday pattern.',
    },
    {
      heading: 'Short months and leap years',
      body: 'Clamping short months is on by default, so the 31st in a 30-day month moves to the 30th and a yearly 29 February falls back to the 28th in common years. Turn clamping off and those months are skipped entirely, so the date appears only when it truly exists.',
    },
    {
      heading: 'Computed in the browser, never uploaded',
      body: 'The schedule is worked out arithmetically in the page from the date you type, so no calendar account, iCalendar file or network request is involved.',
    },
  ],
  related: ['rrule-builder', 'date-add', 'timestamp', 'week-number'],
  status: 'stable',
};
