import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'date-add',
  name: 'Date Add / Subtract',
  category: 'datetime',
  summary: 'Add or subtract years, months, days, hours and minutes from a date.',
  description:
    'Shift a date by calendar months (with correct end-of-month clamping) plus weeks, days, hours and minutes, and see the result in ISO 8601, RFC 2822 and weekday form.',
  keywords: [
    'add days to date',
    'subtract dates',
    'date calculator',
    'add months',
    'date arithmetic',
    'shift date',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'add',
      choices: [
        { value: 'add', label: 'Add' },
        { value: 'subtract', label: 'Subtract' },
      ],
    },
    { key: 'years', label: 'Years', type: 'number', default: 0 },
    { key: 'months', label: 'Months', type: 'number', default: 0 },
    { key: 'weeks', label: 'Weeks', type: 'number', default: 0 },
    { key: 'days', label: 'Days', type: 'number', default: 0 },
    { key: 'hours', label: 'Hours', type: 'number', default: 0 },
    { key: 'minutes', label: 'Minutes', type: 'number', default: 0 },
  ],
  examples: [
    { title: 'One month after a leap day boundary', input: '2024-01-31', options: { months: 1 } },
    { title: 'Ninety minutes', input: '2024-01-01T00:00:00Z', options: { minutes: 90 } },
    { title: 'Minus one day', input: '2024-03-01', options: { operation: 'subtract', days: 1 } },
    { title: 'Add three months to a date', input: '2025-05-15', options: { months: 3 } },
  ],
  article: [
    {
      heading: 'Shifting a date by a chosen amount',
      body: 'Type a base date, either plain YYYY-MM-DD or a full timestamp such as 2024-01-01T00:00:00Z, pick Add or Subtract, and dial in years, months, weeks, days, hours and minutes. The answer is shown as ISO 8601, RFC 2822, a weekday name and the number of calendar days moved.',
    },
    {
      heading: 'Counting to a deadline or anniversary',
      body: 'It is straightforward for a due date: take today, add the number of weeks or days, and read off the resulting weekday and RFC 2822 string for a calendar invite. Leaving the base empty uses the current moment.',
    },
    {
      heading: 'Months clamp at the month end',
      body: 'Years and months are applied first on the calendar fields, so January 31 plus one month lands on February 28 or 29 rather than rolling into March. Weeks, days, hours and minutes are then added as fixed spans of time, which keeps the order of evaluation predictable.',
    },
    {
      heading: 'Calendar maths over fixed time',
      body: 'The year and month shift stays calendar aware, while weeks, days, hours and minutes are pure arithmetic on the clock. Because the former changes the day number, the two stages are not interchangeable when the base month is short.',
    },
    {
      heading: 'Dates are computed on device',
      body: 'The arithmetic runs in the page using the browser clock. The base date and the result are never sent to a server, and the tool needs no network to give you the shifted date.',
    },
  ],
  faq: [
    {
      q: 'What happens to January 31 plus one month?',
      a: 'The day is clamped to the last day of the target month: January 31 + 1 month is February 28 (or 29 in a leap year), never March 2 or 3.',
    },
    {
      q: 'What base date formats are accepted?',
      a: 'A plain YYYY-MM-DD is treated as a UTC date, and any full string the Date parser understands, such as 2024-01-01T12:00:00Z, is accepted. An empty box defaults to the current time.',
    },
    {
      q: 'How is the days-from-base figure computed?',
      a: 'It is the signed difference in whole 24-hour days between the result and the base date, so months that change the day count show up clearly next to the new date.',
    },
  ],
  related: ['date-diff', 'age-calculator'],
  status: 'stable',
};
