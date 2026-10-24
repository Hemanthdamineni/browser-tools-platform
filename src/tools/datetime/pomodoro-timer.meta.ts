import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'pomodoro-timer',
  name: 'Pomodoro Timer',
  category: 'datetime',
  summary:
    'A deadline-accurate Pomodoro timer with configurable work, short-break and long-break cycles.',
  description:
    'Run the classic Pomodoro technique in this tab: a configurable work length, a short break, a long break and how many work sessions earn the long break. The timer is deadline-based, so a throttled or backgrounded tab never drifts, and it announces phase changes with a browser notification when you opt in. Your settings and your running session are kept only in this browser’s localStorage — nothing is uploaded.',
  keywords: [
    'pomodoro timer',
    'focus timer',
    'work timer',
    'pomodoro technique',
    'study timer',
    'timeboxing',
    'break timer',
    'productivity timer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'pomodoro-timer',
  options: [
    {
      key: 'workMinutes',
      label: 'Work length',
      type: 'number',
      default: 25,
      min: 1,
      max: 120,
      step: 1,
      help: 'Minutes in a work (focus) phase.',
    },
    {
      key: 'shortBreakMinutes',
      label: 'Short break',
      type: 'number',
      default: 5,
      min: 1,
      max: 60,
      step: 1,
      help: 'Minutes in a short break after a work phase.',
    },
    {
      key: 'longBreakMinutes',
      label: 'Long break',
      type: 'number',
      default: 15,
      min: 1,
      max: 120,
      step: 1,
      help: 'Minutes in a long break after every cycle of work phases.',
    },
    {
      key: 'cyclesBeforeLongBreak',
      label: 'Work phases before a long break',
      type: 'number',
      default: 4,
      min: 1,
      max: 12,
      step: 1,
      help: 'How many completed work phases run before the long break.',
    },
    {
      key: 'notifyOnPhase',
      label: 'Notify me on each phase change',
      type: 'boolean',
      default: false,
      help: 'Shows a browser notification when a phase starts. You grant permission the first time.',
    },
    {
      key: 'autoStartBreaks',
      label: 'Start breaks automatically',
      type: 'boolean',
      default: false,
      help: 'When a work phase ends, start the break without pressing start again.',
    },
    {
      key: 'autoStartWork',
      label: 'Start the next work phase automatically',
      type: 'boolean',
      default: false,
      help: 'When a break ends, start the next work phase without pressing start again.',
    },
  ],
  examples: [
    {
      title: 'Classic 25 / 5 / 15',
      options: {
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        cyclesBeforeLongBreak: 4,
        notifyOnPhase: false,
        autoStartBreaks: false,
        autoStartWork: false,
      },
    },
    {
      title: 'Short focus sprints',
      options: {
        workMinutes: 15,
        shortBreakMinutes: 3,
        longBreakMinutes: 10,
        cyclesBeforeLongBreak: 3,
        notifyOnPhase: false,
        autoStartBreaks: true,
        autoStartWork: true,
      },
    },
    {
      title: 'Deep-work blocks',
      options: {
        workMinutes: 50,
        shortBreakMinutes: 10,
        longBreakMinutes: 30,
        cyclesBeforeLongBreak: 3,
        notifyOnPhase: true,
        autoStartBreaks: false,
        autoStartWork: false,
      },
    },
  ],
  article: [
    {
      heading: 'What the timer reports back',
      body: 'The countdown itself is drawn by the timer panel, but the tool also reads a session snapshot — the JSON record the panel stores while running. Hand it back and it returns a compact report naming the phase (idle, working, short break or long break), the seconds remaining, and lifetime totals of completed work phases and sessions.',
    },
    {
      heading: 'Timeboxing that survives a background tab',
      body: 'Reach for it when you want fixed work blocks — a twenty-five-minute editing pass, a revision sprint before an exam — while switching between other tabs. Remaining time is computed from a saved deadline rather than by counting ticks, so a suspended tab catches up the moment you return instead of losing minutes.',
    },
    {
      heading: 'The dials that reshape a cycle',
      body: 'Work, short break and long break are independent minute values, and work phases before a long break sets how many focus rounds precede the longer rest. Start breaks automatically and start the next work phase automatically remove the two button presses between phases; notify me on each phase change raises a browser notification at every transition once permission is granted.',
    },
    {
      heading: 'Bounds, defaults and quiet failure',
      body: 'Every numeric field is clamped into its allowed range, so an out-of-range entry becomes the nearest valid value instead of an error. The long break follows only the configured number of completed work phases, never a short break. Decline the notification prompt and phases still advance, just silently.',
    },
    {
      heading: 'Settings stay on this machine',
      body: 'Your configuration and any running session are written only to this browser’s localStorage. Nothing is uploaded, there is no login, and clearing the site data erases both.',
    },
  ],
  faq: [
    {
      q: 'Does it stay accurate when the tab is in the background?',
      a: 'Yes. The countdown is computed from a stored deadline, not from counting ticks, so a throttled or backgrounded tab resumes exactly where it should be when it wakes up.',
    },
    {
      q: 'Where are my settings and my running session stored?',
      a: 'Only in this browser’s localStorage. Nothing is sent anywhere and everything is cleared with the browser’s site data — there is no account and no server.',
    },
    {
      q: 'How do notifications work?',
      a: 'The browser asks for notification permission the first time you turn the toggle on. Once granted, you get a notification at the start of each phase. If you deny it, the timer keeps working silently.',
    },
  ],
  related: ['countdown-timer', 'stopwatch', 'world-clock', 'week-number'],
  status: 'stable',
};
