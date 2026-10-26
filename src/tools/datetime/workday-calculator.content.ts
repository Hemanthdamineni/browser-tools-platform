/**
 * Editorial content for the workday-calculator tool page.
 *
 * Kept out of ``workday-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The two modes and their input shapes',
      body: 'In Add mode the input is a start date and a whole number of business days separated by a comma, such as 2026-01-05,10, and the result is the date that many working days later; a negative count moves backwards. Count mode takes two ISO dates joined by to, or a comma, and tallies the working days between them.',
    },
    {
      heading: 'Quoting a date that lands on a working day',
      body: 'This is the tool for turning a stated lead time into a date you can put in a quotation, and for checking how many billable working days a contract period really contains once weekends and public holidays are taken out of the picture.',
    },
    {
      heading: 'Options: mode, weekend and holidays',
      body: 'Mode switches between adding business days and counting them. Weekend picks which pair is skipped: Saturday and Sunday by default, Friday and Saturday, or Thursday and Friday for regions that rest earlier in the week. Holidays takes one ISO date per line, and each listed date is skipped once even when it also falls on a weekend.',
    },
    {
      heading: 'How the boundaries are counted',
      body: 'In Count mode both the start and end date are included in the tally. In Add mode the start date is not counted, so the result is the first business day strictly after the given number of working days. The count is capped at 100,000, and an impossible date is rejected rather than guessed at.',
    },
    {
      heading: 'Safe for confidential schedules',
      body: 'Every calculation runs on your device. Dates, holiday lists and the resulting schedule never leave the browser, so quotation deadlines and internal milestones stay private and the calculator works without a connection.',
    },
  ],
  faq: [
    {
      q: 'What date formats are accepted?',
      a: 'ISO dates (YYYY-MM-DD). In “Add” mode write the start date and the number of days separated by a comma (e.g. 2026-01-05,10). In “Count” mode write the two dates on one line separated by the word “to” (e.g. 2026-01-01 to 2026-01-31).',
    },
    {
      q: 'How are holidays entered?',
      a: 'In the holidays field, put one ISO date per line (e.g. 2026-12-25). A day that is both a holiday and a weekend is skipped once.',
    },
    {
      q: 'Does it count the end date?',
      a: 'In “Count” mode the start and end dates are inclusive when counting working days. In “Add” mode, the start date itself is not counted — the result is the first business day strictly after the given count.',
    },
    {
      q: 'Can I change the weekend?',
      a: 'Yes — the weekend option supports Saturday+Sunday (default), Friday+Saturday (common in the Gulf), or Thursday+Friday.',
    },
  ],
} as const;
