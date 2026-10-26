/**
 * Editorial content for the csv-to-ics tool page.
 *
 * Kept out of ``csv-to-ics.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From CSV rows to VEVENT blocks',
      body: 'Each data row becomes one VEVENT inside a single VCALENDAR, wrapped with VERSION, PRODID and CALSCALE lines and CRLF line endings as RFC 5545 requires. The first row supplies the headers; title and start are required while end, description and location are optional. Rows with no title, or with a start value that cannot be parsed, are skipped and counted separately.',
    },
    {
      heading: 'Which date formats are understood',
      body: 'The Date format option tells the parser how to read cells: ISO 8601, US month-first with an optional AM/PM marker, or EU day-first. A cell carrying a date but no time becomes an all-day event, written with a DATE value whose DTEND is the following day — the calendar convention for an inclusive date. Times without a zone are written as floating local times.',
    },
    {
      heading: 'Escaping, UIDs and line folding',
      body: 'Commas, semicolons and backslashes inside titles and descriptions are escaped so they cannot break the property, each event gets a generated UID based on its row number, and any line longer than 75 octets is folded with a leading space. Together those details make the file import cleanly into Google Calendar, Outlook and Apple Calendar without a repair step.',
    },
    {
      heading: 'Your events stay in the browser',
      body: 'Conversion is plain string processing in this tab. The CSV is never uploaded, no calendar API is called, and the finished .ics appears as a download only when you ask for it — so private meeting titles, attendees and locations never leave your device.',
    },
  ],
  faq: [
    {
      q: 'Which column names are recognized?',
      a: 'The first row is read as headers. Common names work: title/name/summary, start/startTime/date, end/endTime/dateEnd, description/desc/notes, location/place. Unmapped specials fall back to sensible defaults.',
    },
    {
      q: 'When is an event all-day?',
      a: 'When the start cell has a date but no time (auto mode). All-day events use a DATE value so calendars render them without a timezone.',
    },
    {
      q: 'Does the output follow the RFC?',
      a: 'Yes — RFC 5545: CRLF line endings, escaping of commas/semicolons/backslashes, UID per event and long lines folded at 75 octets so major importers accept the file.',
    },
    {
      q: 'What about timezones?',
      a: 'Date-times are written as floating local times by default (no zone), which most importers treat as the calendar owner’s zone. Turn on “Treat times as UTC” to append Z instead.',
    },
  ],
} as const;
