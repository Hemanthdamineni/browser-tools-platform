import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'countdown-timer',
  name: 'Countdown Timer',
  category: 'datetime',
  summary:
    'Run several countdown timers at once, each with a sound and an optional notification when it ends.',
  description:
    'Keep more than one countdown going at the same time — a tea timer, a pasta timer, a meeting timer — and see the remaining time for each at a glance. Every timer runs from an absolute deadline, so it still finishes at the right moment even if the tab is in the background, and you can pause, resume, restart or remove any of them. Nothing is uploaded and nothing is stored.',
  keywords: [
    'countdown timer',
    'timer',
    'online timer',
    'multiple timers',
    'countdown',
    'timer with alarm',
    'kitchen timer',
    'egg timer',
    'timer sound',
    'timer notification',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  // The timers are live and keep running between answers, which the generic
  // text workbench cannot express, so the tool opts into its own panel.
  panel: 'countdown-timer',
  options: [
    {
      key: 'format',
      label: 'Report time format',
      type: 'select',
      default: 'clock',
      choices: [
        { value: 'clock', label: 'Clock — 02:30' },
        { value: 'words', label: 'Words — 2 minutes 30 seconds' },
      ],
      help: 'How the summary table under the timers writes each duration.',
    },
    {
      key: 'sound',
      label: 'Beep when a timer finishes',
      type: 'boolean',
      default: true,
      help: 'Plays a short chime. It is generated in the browser, so nothing is downloaded.',
    },
    {
      key: 'notify',
      label: 'Send a desktop notification',
      type: 'boolean',
      default: false,
      help: 'The browser asks for permission the first time you switch this on, and only then.',
    },
  ],
  // Each example adds a timer straight away; a name may come first, as in
  // `Tea 3m`. The presets are the other one-click starting points.
  examples: [
    { title: 'Tea — 3 minutes', input: 'Tea 3m' },
    { title: 'Eggs — 90 seconds', input: 'Eggs 90s' },
    { title: 'Pasta — 10 minutes', input: 'Pasta 10m' },
  ],
  related: ['duration-convert', 'timestamp', 'date-add', 'world-clock'],
  status: 'stable',
};
