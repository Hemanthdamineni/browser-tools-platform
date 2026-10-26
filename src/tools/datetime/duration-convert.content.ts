/**
 * Editorial content for the duration-convert tool page.
 *
 * Kept out of ``duration-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Any duration in, every format out',
      body: 'Give the tool a duration in almost any shape and it normalises it to seconds, then shows it back as a human string, an ISO 8601 duration, a clock value, the raw total and a component breakdown. Accepted inputs include "1h 30m", "90 minutes", "PT1H30M", "01:30:00", "1d 12h" and a bare number of seconds.',
    },
    {
      heading: 'Auto-detect versus total seconds',
      body: 'In auto mode a plain number is seconds and anything else is parsed as a duration — ISO 8601 first, then clock notation, then unit tokens such as d, h, m and s, with the long forms understood too. Switch to Total seconds when a bare number must be seconds and everything else should be rejected.',
    },
    {
      heading: 'The month-and-year shortcut',
      body: 'An ISO input with Y or M components uses fixed conversions: a year is 365 days and a month is 30 days. That is the standard approximation, not a calendar calculation, so a span crossing February comes out slightly off. Days, hours, minutes and seconds are exact.',
    },
    {
      heading: 'Clock notation is ambiguous',
      body: 'Two-part values like 01:30 are read as MM:SS, so that input is ninety seconds, not ninety minutes. Use "1:30:00" or "1h 30m" for an hour and a half. Minutes and seconds in clock form must be under 60. Negative durations are allowed and keep their sign.',
    },
    {
      heading: 'Output options and privacy',
      body: 'The Output option narrows the result to one form — human, ISO 8601, clock, total seconds or components — or shows the full set as a table. Everything is computed with plain arithmetic inside this tab; no value is sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Is 01:30 read as 1 hour 30 minutes or 1 minute 30 seconds?',
      a: 'Two-part clock values are read as MM:SS (90 seconds here). Use 1:30:00 or 1h 30m when you mean ninety minutes.',
    },
    {
      q: 'How are months and years converted?',
      a: 'ISO 8601 Y and M components use fixed approximations: a year is 365 days and a month is 30 days. That is the standard, not a calendar calculation, so a span crossing February comes out slightly off while days, hours, minutes and seconds are exact.',
    },
    {
      q: 'Can I convert negative or fractional durations?',
      a: 'Yes. Negative values keep their sign through every output, and fractional units such as 1.5h or 90.25s are accepted in human and bare-seconds input. Clock components must stay whole numbers below 60.',
    },
  ],
} as const;
