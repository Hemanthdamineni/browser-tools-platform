import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'loan-calculator',
  name: 'Loan / EMI Calculator',
  category: 'misc',
  summary: 'Compute monthly payments, total interest and a payoff timeline for a loan.',
  description:
    'Work out the fixed monthly payment on a loan from the principal, annual interest rate and term, then see the total you repay and the interest you pay. Add an extra monthly payment to see how much sooner the loan is cleared and how much interest is saved.',
  keywords: [
    'loan',
    'emi',
    'mortgage',
    'amortise',
    'amortization',
    'monthly payment',
    'interest',
    'payoff',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'principal', label: 'Principal', type: 'number', default: 100000, min: 0 },
    {
      key: 'annualRatePercent',
      label: 'Annual interest rate (%)',
      type: 'number',
      default: 6.5,
      min: 0,
    },
    { key: 'years', label: 'Term (years)', type: 'number', default: 5, min: 0, step: 1 },
    { key: 'extraMonthly', label: 'Extra monthly payment', type: 'number', default: 0, min: 0 },
  ],
  examples: [
    {
      title: '30-year mortgage at 6%',
      input: '',
      options: { principal: 100000, annualRatePercent: 6, years: 30 },
    },
    {
      title: 'Interest-free loan',
      input: '',
      options: { principal: 1200, annualRatePercent: 0, years: 1 },
    },
    {
      title: 'Overpay every month',
      input: '',
      options: {
        principal: 20000,
        annualRatePercent: 5,
        years: 5,
        extraMonthly: 200,
      },
    },
  ],
  related: ['tip-calculator', 'unit-convert'],
  status: 'stable',
};
