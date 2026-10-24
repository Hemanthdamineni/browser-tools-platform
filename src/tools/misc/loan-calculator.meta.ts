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
  article: [
    {
      heading: 'The four numbers you supply',
      body: 'The principal is what you borrow, the annual interest rate is a percentage, the term is the loan length in years, and the extra monthly payment starts at zero. The monthly payment comes from the standard amortisation formula \u2014 principal times the monthly rate, divided by one minus (one plus the monthly rate) to the power of minus the number of payments \u2014 which simplifies to principal divided by payments when the rate is zero. The report is a table with the payment amount, the number of payments, the total repaid and the total interest.',
    },
    {
      heading: 'What an extra payment changes',
      body: 'Adding a regular overpayment shows the payoff moving forward: the new number of payments, the payoff time in years and months, the interest actually paid against the base total, the interest saved and how many instalments were removed. The simulation pays the normal instalment plus your extra each month and clears the balance sooner, so the interest-saved figure is an exact comparison against the schedule without the overpayment.',
    },
    {
      heading: 'Validation and awkward inputs',
      body: 'The principal and the term must be greater than zero and the annual rate must sit between 0 and 100; anything outside that is rejected rather than turned into a meaningless number. An overpayment so small that the instalment never covers the monthly interest is also refused, with an explanation, instead of looping forever. Results are shown to two decimal places and the monthly payment is echoed in the stats line.',
    },
    {
      heading: 'What the model leaves out',
      body: 'This is a plain fixed-rate, fixed-term amortisation model. It does not model a variable rate, escrow or insurance, origination and closing fees, early lump-sum payments, or interest-only periods, and it assumes payments are made on time every month. Treat the output as the mathematical core of a repayment plan, then add your actual fees and charges from the lender\u2019s own schedule. Every figure is computed in this tab with nothing uploaded.',
    },
  ],
  faq: [
    {
      q: 'How is the monthly payment calculated?',
      a: 'With the standard amortisation formula: P · r / (1 − (1+r)^−n), where r is the monthly rate and n is the number of monthly payments. When the rate is zero the payment is simply the principal divided by the number of payments.',
    },
  ],
  related: ['tip-calculator', 'unit-convert'],
  status: 'stable',
};
