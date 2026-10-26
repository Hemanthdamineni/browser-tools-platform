import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'age-calculator',
  name: 'Age Calculator',
  category: 'datetime',
  summary: 'Work out an exact age plus totals, zodiac sign and next birthday.',
  description:
    'Enter a birth date and get the age in years, months and days, lifetime totals, the weekday someone was born, days until the next birthday, and the western zodiac sign.',
  keywords: [
    'age calculator',
    'how old am i',
    'birthday calculator',
    'zodiac sign',
    'days old',
    'age in days',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'asOf',
      label: 'Age at date',
      help: 'Leave blank to use today.',
      type: 'text',
      default: '',
    },
  ],
  examples: [
    { title: 'Millennium baby', input: '2000-01-01', options: { asOf: '2024-01-01' } },
    { title: 'Day before a birthday', input: '2000-06-15', options: { asOf: '2024-06-14' } },
    {
      title: 'Age today, no reference date',
      input: '1995-03-11',
    },
  ],
  related: ['date-diff', 'week-number'],
  status: 'stable',
};
