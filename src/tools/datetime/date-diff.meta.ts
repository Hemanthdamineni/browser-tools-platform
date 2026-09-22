import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'date-diff',
  name: 'Date Difference Calculator',
  category: 'datetime',
  summary: 'Measure the exact gap between two dates in every unit, including business days.',
  description:
    'Compare two dates and get total milliseconds through weeks, a calendar breakdown in years, months and days, complete months, business days, and which date comes first.',
  keywords: [
    'date difference',
    'days between dates',
    'business days',
    'date calculator',
    'time between',
    'duration between dates',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'second',
      label: 'Compare with',
      help: 'Leave blank to compare against right now.',
      type: 'text',
      default: '',
    },
  ],
  examples: [
    { title: 'A leap year', input: '2020-01-01', options: { second: '2021-01-01' } },
    { title: 'One work week', input: '2024-01-01', options: { second: '2024-01-08' } },
  ],
  faq: [
    {
      q: 'How are business days counted?',
      a: 'Each calendar day from Monday to Friday between the two dates counts once; Saturdays and Sundays are skipped. The count is exclusive of the later date.',
    },
  ],
  related: ['date-add', 'age-calculator', 'week-number'],
  status: 'stable',
};
