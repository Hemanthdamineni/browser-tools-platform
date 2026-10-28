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
  related: ['vcard', 'date-add', 'timezone-convert'],
  status: 'stable',
};
