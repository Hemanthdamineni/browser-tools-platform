import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'week-number',
  name: 'Week Number Calculator',
  category: 'datetime',
  summary: 'Get the ISO 8601 week number plus day-of-year, quarter and leap-year facts.',
  description:
    'Enter a date and see its ISO week number and week-year, day of year, days remaining in the year, quarter, ordinal date, leap-year status, and the Monday–Sunday bounds of its ISO week.',
  keywords: [
    'week number',
    'iso week',
    'calendar week',
    'day of year',
    'leap year',
    'quarter',
    'ordinal date',
    'cw',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  article: [
    {
      heading: 'One date, ten calendar facts',
      body: 'Give it a date as YYYY-MM-DD and it returns a two-column table: the ISO week number and week-year, day of year, days remaining in the year, quarter, day of quarter, whether the year is a leap year, the ordinal date, and the Monday and Sunday that bound the ISO week. The stats line shows the compact form, for example 2024-W01.',
    },
    {
      heading: 'The week a deadline falls in',
      body: 'Planning and reporting by week is common — sprint boards, invoicing periods, European calendars — and "which week is 31 December in?" has a surprising answer. Use it to label a reporting period or convert a filing date into its week.',
    },
    {
      heading: 'How the ISO rule is applied',
      body: 'Weeks start on Monday and week 1 contains the first Thursday of the year, so it is the day-of-year boundary that moves rather than the numbering: an early-January date can sit in week 52 or 53 of the previous week-year, which is why the week-year is reported separately. Leap years follow the divisible-by-4, not-100-unless-400 rule.',
    },
    {
      heading: 'Caveats',
      body: 'There are no options here — every fact is computed for the date you supply. Dates are interpreted as UTC, so a bare date never drifts across a timezone boundary. Quarters are plain calendar quarters, so a company whose year starts in April must shift them.',
    },
    {
      heading: 'Computed in the page',
      body: 'All the arithmetic happens in your browser and the date is never sent to a server. It works offline, which helps when the date is a private deadline or a personnel record.',
    },
  ],
  examples: [
    { title: 'New Year Day', input: '2024-01-01' },
    { title: 'Year end', input: '2024-12-31' },
    { title: 'A date in a leap year', input: '2028-02-29' },
  ],
  faq: [
    {
      q: 'What is the ISO 8601 week rule?',
      a: 'Week 1 is the week containing the first Thursday of the year, weeks run Monday to Sunday, and 1 January can therefore belong to week 52 or 53 of the previous year.',
    },
    {
      q: 'Why is the week-year different from the calendar year?',
      a: 'A date near either end of the year can belong to a week that mostly falls in the neighbouring year. 1 January 2024, for example, is in week 1 of 2024, while 31 December 2024 belongs to week 1 of 2025 — so the week-year is reported next to the calendar-based facts instead of assuming they match.',
    },
    {
      q: 'What is an ordinal date?',
      a: 'It is the year plus the day-of-year with three digits, such as 2024-060 for 29 February 2024. Software processes and standards documents often use it because a single number identifies a day unambiguously within a year.',
    },
    {
      q: 'Does it handle dates in other formats?',
      a: "A plain YYYY-MM-DD is parsed as UTC directly. Anything else is handed to the browser's date parser, so an ISO date-time or a familiar written date usually works, but an ambiguous format such as 03/04/2024 is interpreted by the browser's own locale rules.",
    },
  ],
  related: ['date-diff', 'timestamp'],
  status: 'stable',
};
