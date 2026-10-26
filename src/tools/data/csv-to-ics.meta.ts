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
      input:
        'title,date,endDate,location\nConference,2024-03-11,2024-03-13,Berlin\nHoliday,2024-05-01,,',
    },
    {
      title: 'US-format times treated as UTC',
      input: 'name,start,end\nSupport call,01/09/2024 3:30 PM,01/09/2024 4:00 PM',
      options: { dateFormat: 'us', utc: true },
    },
  ],
  related: ['ical-event', 'vcard', 'csv-to-json', 'recurrence-dates'],
  status: 'stable',
};
