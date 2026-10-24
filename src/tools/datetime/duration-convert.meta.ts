import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'duration-convert',
  name: 'Duration Converter',
  category: 'datetime',
  summary: 'Convert durations between human, ISO 8601, clock and plain-seconds forms.',
  description:
    'Paste a duration in any common shape — 1h 30m, PT1H30M, 01:30:00 or a bare number of seconds — and read it back in every other format, with a component breakdown.',
  keywords: [
    'duration converter',
    'seconds to hours',
    'iso 8601 duration',
    'time span',
    'hh:mm:ss',
    'minutes to hours',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Input mode',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'from-seconds', label: 'Total seconds' },
      ],
    },
    {
      key: 'output',
      label: 'Output',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'All formats' },
        { value: 'human', label: 'Human' },
        { value: 'iso8601', label: 'ISO 8601' },
        { value: 'clock', label: 'Clock (HH:MM:SS)' },
        { value: 'seconds', label: 'Total seconds' },
        { value: 'components', label: 'Components' },
      ],
    },
  ],
  examples: [
    { title: 'One hour, one minute, one second', input: '3661' },
    { title: 'ISO duration', input: 'PT2H' },
    { title: 'Days and hours', input: '1d 12h' },
  ],
  article: [
    {
      heading: 'Any duration in, every format out',
      body: 'Give the tool a duration in almost any shape and it normalises it to seconds, then shows it back as a human string, an ISO 8601 duration, a clock value, the raw total and a component breakdown. Accepted inputs include "1h 30m", "90 minutes", "PT1H30M", "01:30:00", "1d 12h" and a bare number of seconds.',
    },
    {
      heading: 'Auto-detect versus total seconds',
      body: 'In auto mode a plain number is seconds and anything else is parsed as a duration — ISO 8601 first, then clock notation, then unit tokens such as d, h, m and s, with the long forms understood too. Switch to Total seconds when a bare number must be seconds and everything else should be rejected.',
    },
    {
      heading: 'The month-and-year shortcut',
      body: 'An ISO input with Y or M components uses fixed conversions: a year is 365 days and a month is 30 days. That is the standard approximation, not a calendar calculation, so a span crossing February comes out slightly off. Days, hours, minutes and seconds are exact.',
    },
    {
      heading: 'Clock notation is ambiguous',
      body: 'Two-part values like 01:30 are read as MM:SS, so that input is ninety seconds, not ninety minutes. Use "1:30:00" or "1h 30m" for an hour and a half. Minutes and seconds in clock form must be under 60. Negative durations are allowed and keep their sign.',
    },
    {
      heading: 'Output options and privacy',
      body: 'The Output option narrows the result to one form — human, ISO 8601, clock, total seconds or components — or shows the full set as a table. Everything is computed with plain arithmetic inside this tab; no value is sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Is 01:30 read as 1 hour 30 minutes or 1 minute 30 seconds?',
      a: 'Two-part clock values are read as MM:SS (90 seconds here). Use 1:30:00 or 1h 30m when you mean ninety minutes.',
    },
  ],
  related: ['timestamp', 'date-diff'],
  status: 'stable',
};
