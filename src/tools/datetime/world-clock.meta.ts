import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'world-clock',
  name: 'World Clock',
  category: 'datetime',
  summary:
    'Current time, date and UTC offset for any IANA time zones, instantly and on your device.',
  description:
    "See the current time across any set of IANA time zones — the classic world clock, but for the whole planet. List zones (one per line or comma separated), pick 12h or 24h, and get a table of time, date and UTC offset for each. Everything is computed on your device using the browser's own time zone data, so it works offline and never leaves your machine.",
  keywords: [
    'world clock',
    'current time zones',
    'time zone clock',
    'multiple timezones now',
    'utc offset now',
    'global clock',
    'time zone time now',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'hour12',
      label: '12-hour time',
      type: 'boolean',
      default: false,
    },
    {
      key: 'showDate',
      label: 'Show the date for each zone',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Core working zones',
      input: 'UTC\nAmerica/New_York\nEurope/London\nAsia/Kolkata\nAsia/Tokyo\nAustralia/Sydney',
    },
    {
      title: 'Twelve hour clock for one city',
      input: 'Asia/Singapore',
      options: { hour12: true },
    },
    {
      title: 'Offset only view',
      input: 'UTC\nEurope/Berlin',
      options: { showDate: false },
    },
  ],
  related: ['timezone-convert', 'timestamp', 'recurrence-dates', 'date-diff'],
  status: 'stable',
};
