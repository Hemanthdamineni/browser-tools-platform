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
  related: ['timestamp', 'date-diff'],
  status: 'stable',
};
