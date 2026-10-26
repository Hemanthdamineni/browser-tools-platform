/**
 * Editorial content for the date-diff tool page.
 *
 * Kept out of ``date-diff.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What you compare',
      body: 'The first date goes in the text box, the second in "Compare with"; leaving the second blank compares against the current moment. A bare YYYY-MM-DD is read as that calendar day in UTC, while other text goes through the browser\u2019s parser, so ISO timestamps with a zone work too. The report is a measure-and-value table.',
    },
    {
      heading: 'Two ways of measuring the gap',
      body: 'One set of rows gives the elapsed time in milliseconds through weeks \u2014 the same duration expressed in different units. A separate row gives the calendar breakdown in years, months and days using borrow arithmetic, so 31 January to 1 March reads as one month and one day rather than a flat 29 days.',
    },
    {
      heading: 'Business days, and how they are bounded',
      body: 'The business-days row walks day by day and counts every Monday to Friday, stopping before the later date, so Monday to Monday is five business days. It is a plain weekday count and knows nothing about public holidays in any country.',
    },
    {
      heading: 'Edge cases, and where it runs',
      body: 'Date-only inputs are compared in UTC fields and are not shifted by your timezone, but a timestamp without a zone is read in local time. Negative gaps are ordered first and a relation row says which date came first. Unparseable input is rejected with the accepted forms suggested, and no date you type is sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'How are business days counted?',
      a: 'Each calendar day from Monday to Friday between the two dates counts once; Saturdays and Sundays are skipped. The count is exclusive of the later date.',
    },
    {
      q: 'Does the business-day count know about holidays?',
      a: 'No. It excludes Saturdays and Sundays only, with no calendar of public or regional holidays, so for payroll or delivery estimates subtract those separately.',
    },
    {
      q: 'How is the calendar breakdown different from total days?',
      a: 'The total-days row is simple elapsed time. The calendar breakdown borrows whole months when the day-of-month goes backwards, which is why 2024-01-31 to 2024-03-01 reads as 1 month and 1 day instead of a bare 30-day count.',
    },
  ],
} as const;
