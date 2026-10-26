/**
 * Editorial content for the ical-event tool page.
 *
 * Kept out of ``ical-event.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the iCalendar Event Generator writes',
      body: 'This tool produces a complete VCALENDAR containing one VEVENT: a random UID, a DTSTAMP, start and end times, optional summary, location, description and URL, and an optional reminder alarm. The result is a downloadable event.ics that Google Calendar, Outlook and Apple Calendar import.',
    },
    {
      heading: 'When to make an .ics file',
      body: 'Use it to turn a meeting described in chat into something the other person can drop straight into their calendar, or to publish an event on a page as a download link.',
    },
    {
      heading: 'The fields that shape the event',
      body: 'Event title is the only required text, though a description alone will do. All-day switches to date-only values, and leaving the end blank makes the event end where it starts. Location, description and URL appear only when filled, and their text is escaped for commas, semicolons, backslashes and newlines.',
    },
    {
      heading: 'How times and reminders are handled',
      body: 'Times are typed as local wall-clock and converted to UTC stamps, so the file carries no timezone. Reminder minutes before is clamped to 0 to 1440 and writes a display alarm; a malformed date or an end before the start raises a clear error. Long lines are folded at 75 octets per RFC 5545.',
    },
    {
      heading: 'The file is built on your device',
      body: 'The calendar is assembled in the browser and never uploaded; the UID is random and the DTSTAMP uses your device clock.',
    },
  ],
  faq: [
    {
      q: 'What timezone is used?',
      a: 'Times are entered in your device’s local timezone and stored as UTC in the file (with TZID omitted), which is what most calendar apps expect for one-off events.',
    },
    {
      q: 'How do I use the output?',
      a: 'Save it as event.ics and double-click it, or paste the text into a .ics file. You can also host it and link to it from a website.',
    },
    {
      q: 'Can I add a reminder to the event?',
      a: 'Yes. Reminder minutes before writes a VALARM block with a display trigger. The value is clamped between 0 and 1440 minutes, and 0, the default, leaves the alarm out entirely.',
    },
  ],
} as const;
