/**
 * Editorial content for the world-clock tool page.
 *
 * Kept out of ``world-clock.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Current time across zones',
      body: 'List IANA zone names on separate lines or separated by commas and the tool returns a table of the current local time, the UTC offset and, by default, the date for each zone. Every value is computed when you run it from your device clock and the browser time zone database.',
    },
    {
      heading: 'Scheduling a call across continents',
      body: 'A typical use is finding a slot that suits London, Bangalore and San Francisco at once. Enter the three zones, run the clock, and compare the offset column to see how far apart the working hours currently sit; the date column flags zones already on the next day.',
    },
    {
      heading: 'Fewer columns and a twelve hour clock',
      body: 'Turning Show the date off leaves just zone, time and offset, which suits a narrow panel. The 12-hour switch adds an AM or PM marker and formats the hour accordingly. Both options apply to every row in the table.',
    },
    {
      heading: 'Unknown names and the sixty zone limit',
      body: 'Names the browser does not recognise are skipped and counted in a note instead of failing the run; if none are valid you get an error suggesting forms like America/Los_Angeles. Duplicate entries collapse and at most sixty zones are processed. Leaving the box empty produces a default set of six.',
    },
    {
      heading: 'Read from your own machine',
      body: 'Each time is worked out locally from the browser time zone data. There are no server lookups, no zone history is kept, and an offline connection changes nothing about the figures.',
    },
  ],
  faq: [
    {
      q: 'Which zones can I use?',
      a: 'Any IANA time zone name — the same list the OS uses: continent/city such as America/Los_Angeles, Europe/Paris, Asia/Singapore. Try entering nothing to get a sensible default set.',
    },
    {
      q: 'What do the offsets mean?',
      a: 'The offset of each zone relative to UTC at this instant (+05:30 for India, -05:00 for New York). It updates automatically for daylight saving since it is computed from the current time.',
    },
    {
      q: 'Is the clock live?',
      a: 'It computes the time when you run it. Times are accurate to the second at that moment — refresh to update.',
    },
  ],
} as const;
