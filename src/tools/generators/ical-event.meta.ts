import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ical-event',
  name: 'iCalendar Event Generator',
  category: 'generators',
  summary: 'Create an .ics calendar event file with reminders that imports into any calendar app.',
  description:
    'Turn an event into a standards-compliant iCalendar (.ics) file — Google Calendar, Outlook, Apple Calendar and fastmail all import it. Set a reminder, location, description and URL.',
  keywords: [
    'ics',
    'ical',
    'calendar event',
    'vcalendar',
    'event file',
    'calendar invite',
    'reminder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'summary', label: 'Event title', type: 'text', default: '' },
    {
      key: 'startDateTime',
      label: 'Starts (YYYY-MM-DD HH:MM, your local time)',
      type: 'text',
      default: '',
      placeholder: '2026-09-22 14:00',
    },
    {
      key: 'endDateTime',
      label: 'Ends (YYYY-MM-DD HH:MM)',
      type: 'text',
      default: '',
      placeholder: '2026-09-22 15:00',
    },
    { key: 'allDay', label: 'All-day event', type: 'boolean', default: false },
    { key: 'location', label: 'Location', type: 'text', default: '' },
    { key: 'description', label: 'Description', type: 'textarea', default: '' },
    { key: 'url', label: 'URL', type: 'text', default: '' },
    {
      key: 'reminderMinutes',
      label: 'Reminder (minutes before, 0 = none)',
      type: 'number',
      default: 0,
      min: 0,
      max: 1440,
    },
  ],
  examples: [
    {
      title: 'One-hour meeting',
      options: {
        summary: 'Launch',
        startDateTime: '2026-10-01 09:00',
        endDateTime: '2026-10-01 10:00',
      },
    },
    {
      title: 'All-day with reminder',
      options: {
        summary: 'Conference',
        startDateTime: '2026-11-05 00:00',
        endDateTime: '2026-11-05 23:59',
        allDay: true,
        reminderMinutes: 1440,
      },
    },
    {
      title: 'Timed event with location and URL',
      options: {
        summary: 'Design review',
        startDateTime: '2026-12-02 15:30',
        endDateTime: '2026-12-02 16:15',
        location: 'Room 4',
        url: 'https://example.com/meet',
        reminderMinutes: 15,
      },
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
  related: ['vcard', 'date-add', 'timezone-convert'],
  status: 'stable',
};
