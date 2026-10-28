import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'stopwatch',
  name: 'Stopwatch',
  category: 'datetime',
  summary:
    'Precise stopwatch with lap splits and keyboard shortcuts — timestamp-based, so it never drifts.',
  description:
    'Start, pause, lap and reset with the keyboard: Space toggles, L records a lap, R resets. Elapsed time is always recomputed from Date.now() timestamps instead of counting timer ticks, so the readout stays exact even when the tab is throttled or asleep. Paste an action log to replay a session and score its laps.',
  keywords: [
    'stopwatch',
    'timer',
    'lap',
    'laps',
    'split',
    'splits',
    'chronometer',
    'keyboard shortcuts',
    'elapsed time',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'precision',
      label: 'Display precision',
      type: 'select',
      default: 'centis',
      choices: [
        { value: 'centis', label: 'Centiseconds (MM:SS.cc)' },
        { value: 'millis', label: 'Milliseconds (MM:SS.mmm)' },
        { value: 'seconds', label: 'Whole seconds (MM:SS)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Two laps and a stop',
      input: 'start 10:00:00\nlap 10:00:15.250\nlap 10:00:31.000\npause 10:00:40',
    },
    {
      title: 'Pause, resume, lap, reset',
      input: 'start 09:00:00\npause 09:00:30\nresume 09:01:00\nlap 09:01:10\nreset',
    },
  ],
  faq: [
    {
      q: 'Why does the stopwatch stay accurate when the tab sleeps?',
      a: 'Elapsed time is never accumulated by counting timer ticks. Every update recomputes (now − startTime) + pausedTotal from the clock, so background throttling or a sleeping tab cannot cause drift — the next tick snaps the readout back to the truth.',
    },
    {
      q: 'What are the keyboard shortcuts?',
      a: 'Space starts, pauses and resumes. L records a lap while running. R resets. Shortcuts are ignored while you are typing in a text field and while modifier keys (Ctrl/Alt/Meta) are held, so browser shortcuts keep working.',
    },
  ],
  related: [  "countdown-timer",
  "pomodoro-timer",
  "timestamp"],
  status: 'beta',
};
