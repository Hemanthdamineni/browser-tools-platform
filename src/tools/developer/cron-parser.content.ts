/**
 * Editorial content for the cron-parser tool page.
 *
 * Kept out of ``cron-parser.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the parser returns',
      body: 'Paste a five-field or six-field cron expression and the tool produces two things: an English sentence describing the schedule, and a list of the next upcoming run times as ISO 8601 timestamps. The number of run times is chosen with the count option, from one to twenty, and the times are always computed in UTC from this device clock.',
    },
    {
      heading: 'Fields, ranges and names',
      body: 'A field accepts an asterisk, a single value, a range such as 1-5, a step written as */10 or 10-30/5, and comma-separated lists that combine any of those. Months accept JAN to DEC and weekdays accept SUN to SAT, with both 0 and 7 meaning Sunday. When day-of-month and day-of-week are both restricted, a date matches if either one matches, as classic cron does.',
    },
    {
      heading: 'The seconds field and verbose descriptions',
      body: 'A six-field expression is read as seconds first, then minutes, hours, day-of-month, month and weekday; the seconds toggle makes that expectation explicit and reports an error if only five fields were given. The verbose switch asks the description library for a wordier sentence, which is easier to read for complicated expressions with several lists.',
    },
    {
      heading: 'No schedule is ever executed',
      body: 'The tool only parses and enumerates — it never schedules or runs anything. Matching is simulated minute by minute (or second by second) up to roughly five years ahead, and a schedule that can never fire, such as 30 February, is reported as an error rather than an empty list. Nothing you type leaves the browser.',
    },
  ],
  faq: [
    {
      q: 'Which time zone are the run times in?',
      a: 'UTC. They are computed from your device clock and printed as ISO 8601 with a trailing Z.',
    },
    {
      q: 'How is day-of-week handled?',
      a: 'Both 0 and 7 mean Sunday, and names like MON or FRI work. When day-of-month and day-of-week are both restricted, a run matches if either one matches — standard cron behavior.',
    },
    {
      q: 'What field syntax is supported?',
      a: 'Asterisk, ranges (1-5), steps (*/10 or 10-30/5), and comma lists, plus JAN–DEC and SUN–SAT names.',
    },
  ],
} as const;
