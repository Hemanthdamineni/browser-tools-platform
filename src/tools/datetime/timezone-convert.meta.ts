import type { ToolMeta } from '@/lib/types';

const ZONES: [string, string][] = [
  ['UTC', 'UTC'],
  ['America/New_York', 'New York'],
  ['America/Chicago', 'Chicago'],
  ['America/Denver', 'Denver'],
  ['America/Los_Angeles', 'Los Angeles'],
  ['America/Sao_Paulo', 'São Paulo'],
  ['Europe/London', 'London'],
  ['Europe/Paris', 'Paris'],
  ['Europe/Berlin', 'Berlin'],
  ['Europe/Moscow', 'Moscow'],
  ['Africa/Cairo', 'Cairo'],
  ['Africa/Johannesburg', 'Johannesburg'],
  ['Asia/Kolkata', 'Kolkata'],
  ['Asia/Dubai', 'Dubai'],
  ['Asia/Karachi', 'Karachi'],
  ['Asia/Dhaka', 'Dhaka'],
  ['Asia/Bangkok', 'Bangkok'],
  ['Asia/Singapore', 'Singapore'],
  ['Asia/Shanghai', 'Shanghai'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Asia/Seoul', 'Seoul'],
  ['Australia/Perth', 'Perth'],
  ['Australia/Sydney', 'Sydney'],
  ['Pacific/Auckland', 'Auckland'],
  ['Pacific/Honolulu', 'Honolulu'],
];

export const meta: ToolMeta = {
  id: 'timezone-convert',
  name: 'Timezone Converter',
  category: 'datetime',
  summary: 'Convert a date and time across world timezones in one table.',
  description:
    'Enter a wall-clock time, pick the zone it belongs to, and see the same instant formatted for a curated set of US, European, Asian or worldwide cities — DST handled via the browser Intl database.',
  keywords: [
    'timezone converter',
    'world clock',
    'time zones',
    'utc',
    'gmt',
    'dst',
    'meeting planner',
    'time difference',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'fromZone',
      label: 'Input timezone',
      type: 'select',
      default: 'UTC',
      choices: ZONES.map(([value, label]) => ({ value, label })),
    },
    {
      key: 'targets',
      label: 'Show zones',
      type: 'select',
      default: 'world',
      choices: [
        { value: 'us', label: 'US zones' },
        { value: 'europe', label: 'European zones' },
        { value: 'asia', label: 'Asian zones' },
        { value: 'world', label: 'Worldwide' },
      ],
    },
  ],
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
  examples: [
    { title: 'Noon UTC worldwide', input: '2024-01-15 12:00' },
    { title: 'Now, US zones', options: { targets: 'us' } },
    {
      title: 'Tokyo morning for European colleagues',
      input: '2024-06-03 09:30',
      options: { fromZone: 'Asia/Tokyo', targets: 'europe' },
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
  related: ['timestamp', 'date-diff', 'week-number'],
  status: 'stable',
};
