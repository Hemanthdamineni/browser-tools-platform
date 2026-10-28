import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'tip-calculator',
  name: 'Tip Calculator',
  category: 'misc',
  summary: 'Calculate a tip, bill total and per-person split.',
  description:
    'Calculate the tip on a bill, split the total between people, and optionally round the total or per-person amount up to a whole currency unit.',
  keywords: ['tip calculator', 'bill split', 'gratuity', 'restaurant', 'per person', 'round up'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'bill', label: 'Bill amount', type: 'number', default: 0, min: 0 },
    { key: 'tipPercent', label: 'Tip percentage', type: 'range', default: 18, min: 0, max: 40 },
    {
      key: 'split',
      label: 'People splitting the bill',
      type: 'number',
      default: 1,
      min: 1,
      max: 50,
      step: 1,
    },
    {
      key: 'roundUp',
      label: 'Round up',
      type: 'select',
      default: 'none',
      choices: [
        { value: 'none', label: 'Do not round' },
        { value: 'total', label: 'Total' },
        { value: 'per-person', label: 'Per person' },
      ],
    },
  ],
  examples: [
    {
      title: 'Split a $100 bill four ways',
      input: '',
      options: { bill: 100, tipPercent: 20, split: 4 },
    },
  ],
  related: [  "loan-calculator",
  "unit-convert"],
  status: 'stable',
};
