/**
 * Editorial content for the age-calculator tool page.
 *
 * Kept out of ``age-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Starting from a birth date',
      body: 'Enter a date as YYYY-MM-DD in the main box and the tool returns a table of facts: the exact age in years, months and days; lifetime totals in days, weeks, months and hours; the weekday the person was born on; the next birthday with the days remaining; and the western zodiac sign.',
    },
    {
      heading: 'Why the breakdown beats dividing days',
      body: 'Anyone can divide a day count by 365.25, but a correct answer has to borrow the real length of the previous month to produce something like 2 years, 11 months, 3 days. Use it for forms that demand a precise age, or simply to find out how many days someone has been alive.',
    },
    {
      heading: 'The Age at date option',
      body: 'Leave it blank to use today, or fill it in to ask the question as of another date — the age at a wedding or at an exam cut-off. Both dates are parsed the same way, and a birth date later than the reference date is rejected.',
    },
    {
      heading: 'Conventions and caveats',
      body: 'Dates are read as UTC, so a bare YYYY-MM-DD never shifts by timezone. The zodiac uses the conventional western cut-off days, which drift by a day from year to year, so treat that row as a fun extra. Month borrowing makes the result match a calendar rather than an average.',
    },
    {
      heading: 'No date of birth is sent anywhere',
      body: "The whole calculation happens in your browser tab and the date is never transmitted. That is precisely the point for a date of birth, which is the kind of personal detail you should not be typing into a stranger's form.",
    },
  ],
  faq: [
    {
      q: 'How is the age in years, months and days computed?',
      a: 'Calendar arithmetic: count whole years, then whole months, then remaining days — borrowing the real length of the previous month when the day of month needs it.',
    },
    {
      q: 'What is the "Age at date" box for?',
      a: 'It sets the reference date the age is measured against. Leave it blank to use today. Fill it in to get an age as of a specific day, such as a wedding, a filing deadline or a school start date.',
    },
    {
      q: 'Are the dates affected by my timezone?',
      a: 'No. A bare YYYY-MM-DD is parsed as UTC and every calculation uses UTC fields, so the result is the same wherever you open the page. Only a full date-time string you paste would carry a timezone.',
    },
    {
      q: 'How accurate is the zodiac sign?',
      a: 'It uses the conventional western cut-off days, which shift by a day from year to year, so treat it as a fun fact rather than an astronomical calculation. Everything else is exact calendar arithmetic.',
    },
  ],
} as const;
