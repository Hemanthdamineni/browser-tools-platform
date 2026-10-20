import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'percentage-calculator',
  name: 'Percentage Calculator',
  category: 'misc',
  summary: 'Percentage of a number, percent change, and percent increase/decrease.',
  description: 'Solve the everyday percentage problems in one place: find a percentage of a number (X% of Y), compute the percentage change between two values, and apply or reverse a percentage increase or decrease. Everything runs on-device with exact arithmetic and clear step-by-step results.',
  keywords: ['percentage', 'percent', '% of', 'percent change', 'percent increase', 'percent decrease', 'markup', 'discount', 'tip math', 'percentage calculator'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'percent-of', choices: [{ value: 'percent-of', label: 'X% of Y' }, { value: 'percent-change', label: 'Percent change' }, { value: 'increase', label: 'Increase by %' }, { value: 'decrease', label: 'Decrease by %' }] },
  ],
  examples: [
    { title: '20% of 150', input: '20 150' },
    { title: 'Change from 80 to 100', input: '80 100', options: { mode: 'percent-change' } },
  ],
  faq: [
    { q: 'How do I type values?', a: 'Enter two numbers separated by a space or comma, in the order shown by the mode (e.g. "20 150" for 20% of 150, or "80 100" for the change from 80 to 100).' },
    { q: 'Can percentages be over 100?', a: 'Yes. For example, 150% of 40 is 60, and a change from 50 to 200 is +300%.' },
    { q: 'Does it round output?', a: 'Results are reported with full precision by default; use the provided rounded figures when you need money-style values.' },
  ],
  related: ['calculator', 'programmer-calculator', 'tip-calculator'],
  status: 'stable',
};
