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
  article: [
    {
      heading: 'What the calculator returns',
      body: 'You enter a bill amount, a tip percentage, the number of people and an optional rounding mode. It returns a five-row table listing the bill, the tip with its percentage, the total, the per-person share and the tip per person, rendered as a table on the page.',
    },
    {
      heading: 'When a quick group settle helps',
      body: 'Useful when you finish a meal, need the per-person amount in front of the server, and do not want to work the maths out on the bill. Everything is computed from four numbers you type, so there is nothing to upload.',
    },
    {
      heading: 'What Round up actually changes',
      body: 'Do not round leaves every value exact to two decimals. Total rounds the final bill up to the next whole currency unit. Per person rounds each share up first, then recomputes the total as that share times the headcount, so the sum of shares always matches the displayed total.',
    },
    {
      heading: 'Validation and integer splitting',
      body: 'The bill cannot be negative or non-finite, the tip must sit between 0 and 100, and the split count is floored to a whole number before division, so 4.7 people is treated as 4. Rounding never revalidates the tip: the tip per person is still the original tip divided by the count. All arithmetic runs on your device.',
    },
  ],
  examples: [
    {
      title: 'Split a $100 bill four ways',
      input: '',
      options: { bill: 100, tipPercent: 20, split: 4 },
    },
    { title: 'Round the total up', options: { bill: 47.2, tipPercent: 18, roundUp: 'total' } },
    {
      title: 'Round each share up',
      options: { bill: 99, tipPercent: 15, split: 3, roundUp: 'per-person' },
    },
  ],
  faq: [
    {
      q: 'Does Round up change the tip amount?',
      a: 'No. The tip is always the bill times the percentage. Round up only adjusts the total or the per-person share: Per person rounds each share and then recalculates the total, while Total rounds the final bill.',
    },
    {
      q: 'Can the split be a decimal?',
      a: 'It is floored to a whole number first, so 4.7 people is treated as 4. The bill and tip validation also reject negative or non-finite values.',
    },
    {
      q: 'Is the bill sent anywhere?',
      a: 'No. The arithmetic is all done in the page from the numbers you type, and nothing is uploaded.',
    },
  ],
  related: ['loan-calculator', 'unit-convert'],
  status: 'stable',
};
