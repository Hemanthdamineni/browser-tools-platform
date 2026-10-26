/**
 * Editorial content for the timezone-convert tool page.
 *
 * Kept out of ``timezone-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it converts',
      body: 'Type a wall-clock date and time, pick the timezone that time belongs to, and the tool shows the same instant as it reads in every other zone in the list — one row per city with its offset and local time. The input is a plain local time, not an instant, so 2024-01-15 12:00 in New York and 2024-01-15 12:00 in UTC are treated as two different moments, which is exactly what you want when you know the time in one place.',
    },
    {
      heading: 'When you need it',
      body: 'Useful for scheduling a call across offices, converting a log timestamp you know is in the server zone, or checking whether a deadline in Sydney has already passed. It is also a quick sanity check before writing a cron job that has to run at a particular local hour somewhere else in the world.',
    },
    {
      heading: 'Zones and DST',
      body: 'The from-zone list is a curated set of major zones covering Europe, the Americas, Africa, Asia and Oceania; the targets option narrows the table to US, European or Asian zones, or shows the whole worldwide list. Offsets come from the browser Intl database for each specific instant, so daylight-saving rules — including the different DST dates the US and Europe keep — are handled per date, not hard-coded.',
    },
    {
      heading: 'Accepted input formats',
      body: 'Anything from a bare date to a full timestamp works: 2024-01-15, 2024-01-15 12:00, 2024-01-15 12:00:30 and 2024-01-15T12:00:30 are all accepted. Leave the field empty to use the current time. A time that falls inside the one-hour gap created by a spring-forward transition resolves to the offset after the gap, because that wall-clock reading does not exist.',
    },
    {
      heading: 'Runs on your clock data, not a server',
      body: 'All the arithmetic uses the timezone database already present in your browser. No date, city or time you type is sent anywhere, and the tool keeps working with no network connection.',
    },
  ],
  faq: [
    {
      q: 'How are daylight-saving transitions handled?',
      a: 'Offsets come from the browser Intl database for each specific instant. A time inside the one-hour "spring forward" gap resolves to the offset after the gap.',
    },
    {
      q: 'What input formats work?',
      a: 'Anything like 2024-01-15, 2024-01-15 12:00, or 2024-01-15T12:00:30. Leave the input blank to use the current time.',
    },
    {
      q: 'Can I pick a city that is not in the from-zone list?',
      a: 'The from-zone select is a curated set of major zones, not the full IANA database. If the zone you need is missing, convert via UTC: pick UTC as the source when you know the UTC time, or add the offset yourself before converting.',
    },
  ],
} as const;
