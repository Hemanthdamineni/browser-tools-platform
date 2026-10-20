import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'workday-calculator',
  name: 'Workday Calculator',
  category: 'datetime',
  summary: 'Add business days to a date or count the working days between two dates, skipping weekends and holidays.',
  description: 'Confirm a real-world delivery date by adding a number of business days to a start date, or count the working days between two dates. The calculator skips weekends (the pair is configurable — Sat/Sun, Fri/Sat, or Thu/Fri) and any holidays you provide as a plain list of ISO dates (YYYY-MM-DD). It runs entirely on-device, so it is safe for confidential schedules and quotation dates.',
  keywords: ['workday calculator', 'business days', 'working days', 'add business days', 'days between dates', 'weekend skip', 'holiday calendar', 'delivery date', 'work week', 'business calendar'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'add', choices: [{ value: 'add', label: 'Add N business days to a date' }, { value: 'between', label: 'Count business days between two dates' }] },
    { key: 'weekend', label: 'Weekend', type: 'select', default: 'ss', choices: [{ value: 'ss', label: 'Saturday + Sunday' }, { value: 'fs', label: 'Friday + Saturday' }, { value: 'tf', label: 'Thursday + Friday' }] },
    { key: 'holidays', label: 'Holidays (one ISO date per line)', type: 'textarea', default: '' },
  ],
  examples: [
    { title: '10 business days from today', input: '2026-01-05,10' },
    { title: 'Business days around a holiday', input: '2026-12-21 to 2026-12-31', options: { holidays: '2026-12-24\n2026-12-25' } },
  ],
  faq: [
    { q: 'What date formats are accepted?', a: 'ISO dates (YYYY-MM-DD). In “Add” mode write the start date and the number of days separated by a comma (e.g. 2026-01-05,10). In “Count” mode write the two dates on one line separated by the word “to” (e.g. 2026-01-01 to 2026-01-31).' },
    { q: 'How are holidays entered?', a: 'In the holidays field, put one ISO date per line (e.g. 2026-12-25). A day that is both a holiday and a weekend is skipped once.' },
    { q: 'Does it count the end date?', a: 'In “Count” mode the start and end dates are inclusive when counting working days. In “Add” mode, the start date itself is not counted — the result is the first business day strictly after the given count.' },
    { q: 'Can I change the weekend?', a: 'Yes — the weekend option supports Saturday+Sunday (default), Friday+Saturday (common in the Gulf), or Thursday+Friday.' },
  ],
  related: ['date-add', 'date-diff', 'duration-convert', 'week-number'],
  status: 'stable',
};
