import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'countdown-timer',
  name: 'Countdown Timer',
  category: 'datetime',
  summary: 'Run several countdown timers at once, each with a sound and an optional notification when it ends.',
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
    'stopwatch alternative',
    'timer sound',
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
      help: 'How the summary table below the timers writes each duration.',
    },
    {
      key: 'sound',
      label: 'Beep when a timer finishes',
      type: 'boolean',
      default: true,
      help: 'Plays a short synthesised chime. It is generated in the browser, so nothing is downloaded.',
    },
    {
      key: 'notify',
      label: 'Send a desktop notification',
      type: 'boolean',
      default: false,
      help: 'The browser asks for permission the first time you switch this on, and only then.',
    },
  ],
  // A panel tool's examples are one-click panel actions: each adds a timer with
  // that duration (a name may come first, as in `Tea 3m`).
  examples: [
    { title: 'Tea — 3 minutes', input: 'Tea 3m' },
    { title: 'Eggs — 90 seconds', input: 'Eggs 90s' },
    { title: 'Pasta — 10 minutes', input: 'Pasta 10m' },
  ],
  faq: [
    {
      q: 'Does a countdown keep running when I switch tabs?',
      a: 'Yes. Each timer stores the moment it should finish, and the remaining time is worked out from the clock again on every tick. Background tabs are slowed down by the browser, but the timer still ends at the right second — and it catches up the instant you come back to the tab.',
    },
    {
      q: 'Can I run more than one timer at a time?',
      a: 'Yes — add as many as you like. Every timer has its own duration, its own Pause, Resume and Restart buttons, and its own sound and notification when it ends.',
    },
    {
      q: 'How does the sound work, and is anything downloaded?',
      a: 'The chime is synthesised in the browser with the Web Audio API, so there is no audio file to download and no network request. If your browser blocks audio until you interact with the page, add a timer once and the sound is unlocked for the rest of the visit.',
    },
    {
      q: 'Will I get a notification when a timer finishes?',
      a: 'Only if you switch notifications on. The permission prompt appears the moment you tick the box, never before, and you can turn it off again at any time. If you leave it off, the timer still beeps and still shows the finished state on screen.',
    },
    {
      q: 'Are my timers saved?',
      a: 'No. They live in this tab only and are gone when you close or reload the page. Nothing about them is written to disk or sent anywhere.',
    },
  ],
  article: [
    {
      heading: 'What this timer does',
      body: 'Add a duration in seconds, minutes and hours — 90s, 2m30s, 1h5m or 5:00 all work — and it starts counting down immediately. Name a timer by putting the name first ("Tea 3m"), or use the presets for one, three, five and ten minutes. Each running timer shows its remaining time in large figures, and can be paused, resumed, restarted or removed on its own; several timers can run side by side without interfering with each other.',
    },
    {
      heading: 'Why the deadline matters',
      body: 'The timer does not count ticks; it records the exact moment it should finish and works out what is left from the clock every quarter of a second. That is what makes it trustworthy in a background tab: browsers deliberately slow timers in tabs you are not looking at, so a counter that simply added up its own ticks would drift. Here a sleeping tab wakes up already expired, and the chime and notification fire as soon as the page runs again.',
    },
    {
      heading: 'Sound and notifications',
      body: 'When a timer reaches zero the panel beeps — a short two-tone chime built with the Web Audio API, so there is no asset file and nothing to download. Tick the notification box and the browser will also raise a desktop notification, but only after you ask for it: the permission prompt appears on that click alone. Both alerts can be switched off, and the finished timer stays on screen until you restart or remove it.',
    },
    {
      heading: 'Reading the summary',
      body: 'Below the timers, a summary table lists each one with the duration you set, what is left and whether it is running, paused or finished, in either clock form (02:30) or words (2 minutes 30 seconds). It is handy when several timers are going at once and you want to check the whole picture in one place, and it is plain text you can copy out.',
    },
    {
      heading: 'Privacy',
      body: 'Everything happens in this tab. Durations, names and remaining times are held in memory only, never written to storage and never sent anywhere. The chime is generated locally, notifications are issued by your own browser, and the page keeps working with no network connection at all.',
    },
  ],
  related: ['duration-convert', 'timestamp', 'date-add', 'world-clock'],
  status: 'stable',
};
