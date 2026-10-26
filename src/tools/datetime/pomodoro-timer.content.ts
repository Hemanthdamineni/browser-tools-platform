/**
 * Editorial content for the pomodoro-timer tool page.
 *
 * Kept out of ``pomodoro-timer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
