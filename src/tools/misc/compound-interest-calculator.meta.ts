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
      max: 100,
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
  article: [
    {
      heading: 'A year-by-year growth table',
      body: 'The text box is ignored — the projection is driven by the options. The result is a table with one row per year: the starting balance, what was contributed, the interest earned and the closing balance. The notes add total invested, total interest and a growth multiplier.',
    },
    {
      heading: 'Projecting a savings plan',
      body: 'Use it to see what a monthly deposit into an index fund might look like in twenty years, to compare monthly against annual compounding, or to show someone why starting five years earlier matters. Because the breakdown is per year, you can watch interest overtake contributions.',
    },
    {
      heading: 'Options that change the projection',
      body: "Starting balance and Annual interest rate set the inputs and Years (1–100) sets the horizon. Compound frequency chooses annually, quarterly, monthly, daily or continuously: the annual rate is divided by the number of periods, so monthly compounding at 12% adds 1% each month. Period contribution is added at the end of every compounding period, after that period's interest.",
    },
    {
      heading: 'Caveats',
      body: 'Continuous compounding uses e^rt and has no periods, so a period contribution is not supported there and the tool says so. The model uses a nominal annual rate and a 365-day year rather than the 360-day convention some banks use, so figures can differ slightly from a statement. No tax, fee or inflation adjustment is applied.',
    },
    {
      heading: 'Your numbers stay in the tab',
      body: 'The whole projection is arithmetic in your browser; no balance, rate or contribution is ever sent anywhere. Planning a private financial position here is safe, and it works offline.',
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
  faq: [
    {
      q: "How is each period's interest computed?",
      a: 'The annual rate is divided by the compound frequency to give the marginal rate, and interest is credited on the running balance each period. With monthly compounding at 12%, each month adds 1% to the current balance — growth compounds because the base grows every month.',
    },
    {
      q: 'What does the per-year table optimise for?',
      a: 'The engine steps period by period to keep the math exact and then aggregates into one row per year: start balance, total contribution for the year, interest earned in the year and end balance. This keeps the output compact even for daily compounding over 100 years.',
    },
    {
      q: 'When are contributions added?',
      a: "At the end of each compounding period, after that period's interest. Monthly compounding with monthly deposits therefore matches the future-value-of-an-ordinary-annuity formula. Continuous compounding has no periods, so contributions are not supported there.",
    },
    {
      q: 'Why might my numbers differ slightly from a bank?',
      a: 'Banks often quote APR and accrue through a year-end of 360 days. This tool uses the nominal annual rate divided by the compounding frequency and a 365-day year. Tiny differences in rounding convention can also appear; figures are shown to 2 decimal places.',
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
