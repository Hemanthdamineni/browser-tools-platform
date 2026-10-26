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
  examples: [
    { title: 'New Year Day', input: '2024-01-01' },
    { title: 'Year end', input: '2024-12-31' },
    { title: 'A date in a leap year', input: '2028-02-29' },
  ],
  related: ['date-diff', 'timestamp'],
  status: 'stable',
};
