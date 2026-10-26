/**
 * Editorial content for the rrule-builder tool page.
 *
 * Kept out of ``rrule-builder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the builder produces',
      body: 'Filling in the form assembles one RFC 5545 RRULE line, the string that goes inside a VEVENT to say how an event repeats. It always starts with FREQ and adds INTERVAL only when the repeat is not every period, BYDAY for weekly rules, BYMONTHDAY for monthly ones, and at most one of COUNT or UNTIL. Alongside the rule the notes carry a plain-English reading of it — "Repeats every 2 weeks on Monday, Wednesday" — so you can check the grammar without decoding the codes. The output downloads as recurrence-rule.txt.',
    },
    {
      heading: 'Weekly rules and BYDAY',
      body: 'Weekday selection is only meaningful for a weekly frequency, and using it on a daily or monthly rule is rejected rather than quietly ignored. Enter the codes MO through SU separated by commas or spaces; case does not matter, the list is normalised into calendar order, and a repeated day is an error. Leave the field empty and the rule carries no BYDAY at all, which means the event simply repeats on whatever weekday DTSTART names — the notes state that explicitly so the result is never ambiguous.',
    },
    {
      heading: 'Count, end date and awkward month days',
      body: 'A rule may end by counting occurrences or by reaching a date, never both, and the builder refuses the combination. A count of zero means no COUNT part is emitted, leaving the rule open-ended; otherwise the count is written as-is. An end date must be a real calendar date in YYYY-MM-DD form and is emitted as a UTC date-time on the final second of that day, so the last day itself is included. For monthly rules, choosing a day of 29 or later adds a warning, because months without that day simply produce no occurrence.',
    },
    {
      heading: 'What it does not do',
      body: 'The result is a single recurrence rule, not a complete calendar entry: there is no DTSTART, no timezone parameter, no EXDATE to skip individual dates, and no BYSETPOS for things like the last Friday of the month. Those belong in the surrounding VEVENT, where DTSTART defines the first occurrence the rule counts from. Validation happens as you build, and the errors name the field at fault, such as an out-of-range interval or a weekday given for a monthly rule. Everything is computed on your device — no rule you type is transmitted anywhere.',
    },
  ],
  faq: [
    {
      q: 'How do I use the generated rule?',
      a: 'Add the RRULE line inside a VEVENT in an iCalendar file. DTSTART defines the first occurrence; the rule describes repeats relative to that event start.',
    },
    {
      q: 'Can I specify both COUNT and UNTIL?',
      a: 'No. RFC 5545 requires a recurrence rule to use at most one of COUNT or UNTIL.',
    },
    {
      q: 'Are dates timezone-aware?',
      a: 'UNTIL is emitted as a date-only value in YYYYMMDD form. For date-time DTSTART values, RFC 5545 generally requires UNTIL in UTC; use a UTC timestamp-aware calendar library for that case.',
    },
  ],
} as const;
