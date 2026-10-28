import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'countdown-timer',
  name: 'Countdown Timer',
  category: 'datetime',
  summary: 'Run multiple named countdown timers that beep and notify when they finish.',
  description:
    'Create several named timers at once — one per line, e.g. "tea 3m" or "standup @ 14:30". Timers are timestamp-based, so they stay accurate even if the tab throttles timers. When a timer reaches zero the tool plays a WebAudio beep and shows a desktop notification.',
  keywords: [
    'countdown timer',
    'kitchen timer',
    'multiple timers',
    'alarm',
    'notification',
    'beep',
    'pomodoro',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'repeatBeep',
      label: 'Repeat beep until dismissed',
      type: 'boolean',
      default: false,
      help: 'Play the finish beep every second until you stop it, instead of a single three-tone chime.',
    },
  ],
  examples: [
    { title: 'Tea and eggs', input: 'tea 3m\neggs 8m' },
    { title: 'Target time of day', input: 'standup @ 14:30' },
    { title: 'Long timer', input: 'laundry 1h 15m' },
  ],
  faq: [
    {
      q: 'Why do timers keep accurate time if the tab is in the background?',
      a: 'Timers are timestamp-based: each one stores its absolute finish time, and the remaining time is recomputed from the clock, so background throttling of setTimeout cannot make them drift.',
    },
    {
      q: 'Why did I not hear the beep?',
      a: 'Browsers only allow audio after you interact with the page. Run the timers once from a click, and keep the tab open until they finish.',
    },
  ],
  related: [  "stopwatch",
  "timestamp",
  "world-clock"],
  status: 'stable',
};
