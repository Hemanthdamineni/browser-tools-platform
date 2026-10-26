/**
 * Editorial content for the recurrence-dates tool page.
 *
 * Kept out of ``recurrence-dates.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Concrete dates rather than a rule string',
      body: 'Give a start date as YYYY-MM-DD and the tool lists the upcoming dates the pattern really lands on, each with its weekday, as a numbered table of date and occurrence. Patterns cover a fixed day each month, the Nth or last weekday of a month, chosen weekdays every N weeks, and the same date each year.',
    },
    {
      heading: 'Where upcoming dates are useful',
      body: 'It is handy for listing paydays on a fortnightly cycle, working out when the second Tuesday meeting falls, or checking that a yearly renewal never lands on a weekend.',
    },
    {
      heading: 'Options that shape the list',
      body: 'Occurrences sets how many dates are shown and is held between 1 and 50. Interval is the skip count, up to 12, so weekly with interval 2 means every other week. Weekday selects the day, with auto reusing the start date weekday, and Nth is read only by the recurring weekday pattern.',
    },
    {
      heading: 'Short months and leap years',
      body: 'Clamping short months is on by default, so the 31st in a 30-day month moves to the 30th and a yearly 29 February falls back to the 28th in common years. Turn clamping off and those months are skipped entirely, so the date appears only when it truly exists.',
    },
    {
      heading: 'Computed in the browser, never uploaded',
      body: 'The schedule is worked out arithmetically in the page from the date you type, so no calendar account, iCalendar file or network request is involved.',
    },
  ],
  faq: [
    {
      q: 'How do I input the start date?',
      a: 'Paste a single date in YYYY-MM-DD form, for example 2026-10-18. Alternative formats like 18/10/2026 are recognised when the numbers are unambiguous.',
    },
    {
      q: 'What happens on the 31st in a 30-day month?',
      a: 'With clamping on (default) the date rolls to the last day of that month, like real calendar software. With clamping off, short months are skipped and the 31st only appears in months that have one.',
    },
    {
      q: 'How is leap day February 29 handled?',
      a: 'With a yearly pattern, clamping rolls it to February 28 in non-leap years; without clamping it only occurs in leap years.',
    },
    {
      q: 'Does this build an iCalendar rule?',
      a: 'No — it computes the concrete next dates directly. If you need an RRULE string, use the iCalendar Recurrence Rule Builder instead.',
    },
  ],
} as const;
