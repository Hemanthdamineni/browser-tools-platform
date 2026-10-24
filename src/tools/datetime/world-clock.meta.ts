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
  related: ['timezone-convert', 'timestamp', 'recurrence-dates', 'date-diff'],
  status: 'stable',
};
