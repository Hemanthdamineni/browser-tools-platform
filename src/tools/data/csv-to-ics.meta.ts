import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-ics',
  name: 'CSV to iCalendar',
  category: 'data',
  summary:
    'Turn a CSV of events into a downloadable .ics file importable into Google Calendar, Outlook or Apple Calendar.',
  description:
    'Upload-style conversion: give it a CSV where each row is an event — title, start, end, optional description, location — and get back a complete RFC 5545 .ics file with one VEVENT per row. Auto-detects the separator (comma/tab/semicolon), reads ISO, US or EU date formats, treats date-only rows as all-day events, escapes text and UIDs correctly, and folds long lines at 75 octets so every calendar importer accepts it. 100% on-device.',
  keywords: [
    'csv to ics',
    'csv to calendar',
    'generate ics file',
    'calendar import',
    'event converter',
    'ics generator',
    'import events to calendar',
    'vcalendar from csv',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Column separator',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: ',', label: 'Comma ,' },
        { value: '\t', label: 'Tab' },
        { value: ';', label: 'Semicolon ;' },
      ],
      default: 'auto',
    },
    {
      key: 'dateFormat',
      label: 'Date format in CSV',
      type: 'select',
      choices: [
        { value: 'iso', label: 'ISO 8601 (2024-01-05T09:00:00)' },
        { value: 'us', label: 'US (01/05/2024 9:00 AM)' },
        { value: 'eu', label: 'EU (05/01/2024 09:00)' },
      ],
      default: 'iso',
    },
    {
      key: 'utc',
      label: 'Treat times as UTC (append Z)',
      type: 'boolean',
      default: false,
    },
    {
      key: 'allDay',
      label: 'All-day events',
      type: 'select',
      choices: [
        { value: 'auto', label: 'Auto (date-only rows)' },
        { value: 'never', label: 'Never — require time' },
      ],
      default: 'auto',
    },
  ],
  examples: [
    {
      title: 'Three events',
      input:
        'title,start,end,description\nStandup,2024-01-05T09:00:00,2024-01-05T09:30:00,Team sync\nReview,2024-01-06T14:00:00,2024-01-06T15:00:00,Code review',
    },
    {
      title: 'All-day events from date-only cells',
      input: 'title,date,endDate,location\nConference,2024-03-11,2024-03-13,Berlin\nHoliday,2024-05-01,,',
    },
    {
      title: 'US-format times treated as UTC',
      input: 'name,start,end\nSupport call,01/09/2024 3:30 PM,01/09/2024 4:00 PM',
      options: { dateFormat: 'us', utc: true },
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
  related: ['ical-event', 'vcard', 'csv-to-json', 'recurrence-dates'],
  status: 'stable',
};
