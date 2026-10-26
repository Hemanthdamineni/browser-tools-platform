/**
 * Editorial content for the sip-calculator tool page.
 *
 * Kept out of ``sip-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the projection shows',
      body: 'The calculator simulates a monthly mutual-fund style plan and reports the total paid in, the estimated end value, and the estimated gain between them. A breakdown for every completed year lists the instalment in force and the balance at that point. The chart view draws that same data as a downloadable SVG image; the table view prints it as rows — the same numbers in different clothing, so pick whichever your audience reads more easily.',
    },
    {
      heading: 'How the month-by-month maths works',
      body: 'The engine steps through every month rather than applying a closed-form annuity formula, so a step-up or a part-year duration needs no special case. Each month the balance is multiplied by the monthly rate — the annual return divided by twelve — and the instalment for that month is added. The timing setting decides whether the instalment lands before or after that month’s growth: at the start it earns that month’s return, at the end it only earns from the next. The two plans differ by exactly one month of interest on the running total.',
    },
    {
      heading: 'Step-ups, lumpsum and part years',
      body: 'An annual step-up raises the instalment once a year on the plan’s anniversary, so year one runs at the base amount and year two at the base times one plus the step-up; zero keeps it flat. A one-time lumpsum is invested before the first instalment, so it compounds for the whole term alongside the SIP. A duration can include extra months, and the table labels the final row as a part-year milestone such as 10y 3m.',
    },
    {
      heading: 'Limits, assumptions and privacy',
      body: 'This is an illustration, not a forecast and not financial advice. A single constant annual return is assumed, and tax, exit loads, expense ratios and real market moves are ignored. The guards reject a duration under a month, a plan with neither a SIP nor a lumpsum, and projections past an unrealistic ceiling, each with a message naming the field to change. Everything is computed in your browser — no amount you enter is uploaded and no request is made.',
    },
  ],
  faq: [
    {
      q: 'Is this financial advice?',
      a: 'No. This calculator is an educational projection, not financial advice and not a recommendation to buy any product. It assumes a single constant annual return that you choose yourself, and it ignores taxes, exit loads, expense ratios, fund switching and market volatility. Returns are not guaranteed — real mutual fund returns vary year to year and can be negative — so treat the result as an illustration rather than a forecast.',
    },
    {
      q: 'When is each monthly instalment invested?',
      a: 'By default each instalment is treated as invested at the start of the month, so it also earns that month’s growth — the same convention most Indian mutual-fund SIP calculators use. That is why ₹5,000 a month at 12% for 10 years projects to about ₹11,61,695. Choose "at the end of the month" to model an instalment that is debited after the month’s return is credited; the projection is then lower by exactly one month’s interest on the total (₹11,50,193 for the same plan).',
    },
    {
      q: 'How does the annual step-up work?',
      a: 'The instalment is raised by the step-up percentage once a year, on the anniversary of the plan. With a 10% step-up, year 1 runs at ₹5,000 a month, year 2 at ₹5,500, year 3 at ₹6,050, and so on. A step-up of 0% keeps the instalment flat for the whole plan.',
    },
    {
      q: 'How is the projected value calculated?',
      a: 'The plan is simulated month by month. The lumpsum is invested first and every month the balance earns the monthly rate (annual return ÷ 12) and the instalment for that month is added — at the start or the end of the month, depending on the setting. The year-by-year table reports the running total paid in and the balance at each year end.',
    },
    {
      q: 'Can I add a one-time lumpsum?',
      a: 'Yes. The lumpsum is invested at the very start, so it compounds for the whole plan, and the SIP runs alongside it. Set the lumpsum to 0 for a pure SIP.',
    },
    {
      q: 'Are the returns guaranteed?',
      a: 'No. The annual return is an assumption you supply. Mutual fund returns are not guaranteed, they change every year, and a sustained loss would leave the final value below the amount invested. For a goal that has a deadline, plan on a return you would still be happy with if the market disappointed.',
    },
  ],
} as const;
