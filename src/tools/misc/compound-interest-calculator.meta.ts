import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'compound-interest-calculator',
  name: 'Compound Interest Calculator',
  category: 'misc',
  summary:
    'Project savings growth with compound interest, optional regular contributions and a per-year breakdown.',
  description:
    'See how an investment grows over time with compound frequency options (annually, quarterly, monthly, daily or continuous), an optional regular contribution added at the end of each period, and a per-year breakdown showing starting balance, contribution, interest earned and ending balance. Interest is credited on the running balance so growth compounds period over period.',
  keywords: [
    'compound interest',
    'compound interest calculator',
    'savings calculator',
    'investment growth',
    'APY',
    'annual percentage yield',
    'future value',
    'regular contributions',
    'time value of money',
    'interest calculator',
    'retirement savings',
    'growth chart',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'principal',
      label: 'Starting balance',
      type: 'number',
      default: 10000,
      min: 0,
      step: 1,
    },
    {
      key: 'rate',
      label: 'Annual interest rate (%)',
      type: 'number',
      default: 5,
      min: 0,
      step: 1,
    },
    {
      key: 'years',
      label: 'Years',
      type: 'number',
      default: 10,
      min: 1,
      step: 1,
    },
    {
      key: 'compounding',
      label: 'Compound frequency',
      type: 'select',
      default: 'monthly',
      choices: [
        { value: 'annually', label: 'Annually (1×)' },
        { value: 'quarterly', label: 'Quarterly (4×)' },
        { value: 'monthly', label: 'Monthly (12×)' },
        { value: 'daily', label: 'Daily (365×)' },
        { value: 'continuous', label: 'Continuously (e^rt)' },
      ],
    },
    {
      key: 'contribution',
      label: 'Period contribution',
      type: 'number',
      default: 0,
      min: 0,
      step: 1,
    },
  ],
  examples: [
    {
      title: 'Monthly compounding with no deposits',
      input: ' ', // keep
      options: { principal: 10000 },
    },
    {
      title: 'Daily compounding',
      input: 'none',
      options: { principal: 100000 },
    },
    {
      title: 'Use any text input',
      input: 'type something here — options drive the calculation',
      options: { principal: 5000, rate: 7, years: 25, compounding: 'monthly', contribution: 200 },
    },
  ],
  related: [
    'loan-calculator',
    'percentage-calculator',
    'tip-calculator',
    'statistics-calculator',
    'calculator',
  ],
  status: 'stable',
};
