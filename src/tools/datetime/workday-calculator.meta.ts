import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'workday-calculator',
  name: 'Workday Calculator',
  category: 'datetime',
  summary:
    'Add business days to a date or count the working days between two dates, skipping weekends and holidays.',
  description:
    'Confirm a real-world delivery date by adding a number of business days to a start date, or count the working days between two dates. The calculator skips weekends (the pair is configurable — Sat/Sun, Fri/Sat, or Thu/Fri) and any holidays you provide as a plain list of ISO dates (YYYY-MM-DD). It runs entirely on-device, so it is safe for confidential schedules and quotation dates.',
  keywords: [
    'workday calculator',
    'business days',
    'working days',
    'add business days',
    'days between dates',
    'weekend skip',
    'holiday calendar',
    'delivery date',
    'work week',
    'business calendar',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'add',
      choices: [
        { value: 'add', label: 'Add N business days to a date' },
        { value: 'between', label: 'Count business days between two dates' },
      ],
    },
    {
      key: 'weekend',
      label: 'Weekend',
      type: 'select',
      default: 'ss',
      choices: [
        { value: 'ss', label: 'Saturday + Sunday' },
        { value: 'fs', label: 'Friday + Saturday' },
        { value: 'tf', label: 'Thursday + Friday' },
      ],
    },
    { key: 'holidays', label: 'Holidays (one ISO date per line)', type: 'textarea', default: '' },
  ],
  examples: [
    { title: '10 business days from today', input: '2026-01-05,10' },
    {
      title: 'Business days around a holiday',
      input: '2026-12-21,7',
      options: { holidays: '2026-12-24\n2026-12-25' },
    },
    {
      title: 'Five days back with a Gulf weekend',
      input: '2026-03-10,-5',
      options: { weekend: 'fs' },
    },
  ],
  related: ['date-add', 'date-diff', 'duration-convert', 'week-number'],
  status: 'stable',
};
