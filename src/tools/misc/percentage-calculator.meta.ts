import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'percentage-calculator',
  name: 'Percentage Calculator',
  category: 'misc',
  summary: 'Percentage of a number, percent change, and percent increase/decrease.',
  description:
    'Solve the everyday percentage problems in one place: find a percentage of a number (X% of Y), compute the percentage change between two values, and apply or reverse a percentage increase or decrease. Everything runs on-device with exact arithmetic and clear step-by-step results.',
  keywords: [
    'percentage',
    'percent',
    '% of',
    'percent change',
    'percent increase',
    'percent decrease',
    'markup',
    'discount',
    'tip math',
    'percentage calculator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'percent-of',
      choices: [
        { value: 'percent-of', label: 'X% of Y' },
        { value: 'percent-change', label: 'Percent change' },
        { value: 'increase', label: 'Increase by %' },
        { value: 'decrease', label: 'Decrease by %' },
      ],
    },
  ],
  examples: [
    { title: '20% of 150', input: '20 150' },
    { title: 'Change from 80 to 100', input: '80 100', options: { mode: 'percent-change' } },
    { title: 'Increase 50 by 15%', input: '50 15', options: { mode: 'increase' } },
    { title: 'Apply a 25% discount', input: '40 25', options: { mode: 'decrease' } },
  ],
  article: [
    {
      heading: 'The four everyday problems in one place',
      body: 'Choose a mode and type two numbers. X% of Y multiplies Y by X over 100. Percent change finds how much B moved relative to A. Increase by % and Decrease by % apply a percentage to a base, the arithmetic behind a markup, a sale or a tip split. Every result comes back with the working shown.',
    },
    {
      heading: 'The order of the two numbers',
      body: 'The mode sets the meaning of each slot. For X% of Y the first number is the percentage and the second the base, so "20 150" means 20% of 150. For percent change the first is the from value and the second the to value, so "80 100" is the change from 80 to 100. For increase and decrease the first is the base and the second the percentage to move it, so "50 15" is 50 increased by 15%.',
    },
    {
      heading: 'Reading the result table',
      body: 'The result is a small table with the question, the arithmetic you would do on paper — such as 150 × 20/100 — and the answer. A sentence restates the outcome in words, and where the mode allows a money-style figure a rounded version is given alongside the full-precision value.',
    },
    {
      heading: 'Percentages over one hundred',
      body: 'There is no artificial cap. 150% of 40 is 60, a change from 50 to 200 is +300%, and decreasing by 110% pushes a value below zero. The only undefined case is percent change from zero, which is rejected. Results are shown at full precision unless a rounded figure is asked for.',
    },
    {
      heading: 'Done on your device',
      body: 'The arithmetic is plain number handling in this tab with no request to a calculator service. Nothing you type is sent anywhere, so a markup or a tip you are still deciding is not transmitted.',
    },
  ],
  faq: [
    {
      q: 'How do I type values?',
      a: 'Enter two numbers separated by a space or comma, in the order shown by the mode (e.g. "20 150" for 20% of 150, or "80 100" for the change from 80 to 100).',
    },
    {
      q: 'Can percentages be over 100?',
      a: 'Yes. For example, 150% of 40 is 60, and a change from 50 to 200 is +300%.',
    },
    {
      q: 'Does it round output?',
      a: 'Results are reported with full precision by default; use the provided rounded figures when you need money-style values.',
    },
  ],
  related: ['calculator', 'programmer-calculator', 'tip-calculator'],
  status: 'stable',
};
