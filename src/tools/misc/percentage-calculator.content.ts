/**
 * Editorial content for the percentage-calculator tool page.
 *
 * Kept out of ``percentage-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The four everyday problems in one place',
      body: 'Choose a mode and type two numbers. X% of Y multiplies Y by X over 100. Percent change finds how much B moved relative to A. Increase by % and Decrease by % apply a percentage to a base — the arithmetic behind a markup, a sale or a tip split.',
    },
    {
      heading: 'The order of the two numbers',
      body: 'For X% of Y the first number is the percentage and the second the base, so "20 150" means 20% of 150. For percent change the first is the from value and the second the to value. For increase and decrease the first is the base and the second the percentage, so "50 15" is 50 increased by 15%.',
    },
    {
      heading: 'Reading the result table',
      body: 'The result is a small table with the question, the arithmetic you would do on paper — such as 150 × 20/100 — and the answer. A sentence restates the outcome in words, and where the mode allows a money-style figure a rounded version is given alongside the full-precision value.',
    },
    {
      heading: 'Percentages over one hundred',
      body: 'There is no artificial cap. 150% of 40 is 60, a change from 50 to 200 is +300%, and decreasing by 110% pushes a value below zero. The only undefined case is percent change from zero, which is rejected.',
    },
    {
      heading: 'Done on your device',
      body: 'The arithmetic is plain number handling in this tab with no request to a calculator service. Nothing you type is sent anywhere.',
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
} as const;
