/**
 * Editorial content for the loan-calculator tool page.
 *
 * Kept out of ``loan-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The four numbers you supply',
      body: 'The principal is what you borrow, the annual interest rate is a percentage, the term is the loan length in years, and the extra monthly payment starts at zero. The monthly payment uses the standard amortisation formula \u2014 principal times the monthly rate over one minus (one plus the rate) to the power of minus the number of payments \u2014 which simplifies to principal divided by payments at zero interest. The report lists the payment, the number of payments, the total repaid and the total interest.',
    },
    {
      heading: 'What an extra payment changes',
      body: 'Adding a regular overpayment shows the payoff moving forward: the new payment count, the payoff time in years and months, the interest paid against the base total, the interest saved and the instalments removed. The simulation pays the normal instalment plus your extra each month, so the interest-saved figure is exact.',
    },
    {
      heading: 'Validation and awkward inputs',
      body: 'The principal and term must be greater than zero and the rate must sit between 0 and 100; anything outside is rejected rather than turned into a meaningless number. An overpayment too small to cover the monthly interest is also refused, with an explanation, instead of looping forever. Results show two decimals, with the monthly payment echoed in the stats.',
    },
    {
      heading: 'What the model leaves out',
      body: 'This is a plain fixed-rate, fixed-term amortisation model: no variable rate, escrow, fees, early lump sums or interest-only periods, and on-time payments assumed. Treat the output as the mathematical core of a plan, then add your actual lender charges. Every figure is computed in this tab with nothing uploaded.',
    },
  ],
  faq: [
    {
      q: 'How is the monthly payment calculated?',
      a: 'With the standard amortisation formula: P · r / (1 − (1+r)^−n), where r is the monthly rate and n is the number of monthly payments. When the rate is zero the payment is simply the principal divided by the number of payments.',
    },
    {
      q: 'Does an extra payment shorten the term or lower the instalment?',
      a: 'It shortens the term. The simulation keeps the contractual instalment and adds your overpayment on top, so the balance clears sooner and you pay less interest; it does not recalculate a smaller monthly payment.',
    },
    {
      q: 'Does the result include fees or insurance?',
      a: 'No. Only principal and interest are modelled, so a mortgage quote with escrow, insurance or origination fees will be lower than what you actually pay each month. Add those charges to the payment yourself.',
    },
  ],
} as const;
