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
  related: ['date-diff', 'age-calculator'],
  status: 'stable',
};
