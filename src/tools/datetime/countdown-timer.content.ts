/**
 * Editorial content for the countdown-timer tool page.
 *
 * Kept out of ``countdown-timer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What this timer does',
      body: 'Add a duration — 90s, 2m30s, 1h5m and 5:00 all work — and it starts counting down at once. Name a timer by writing the name first (Tea 3m), or use the one, three, five and ten minute presets. Several timers run side by side, each with its own Pause, Resume, Restart and Remove controls.',
    },
    {
      heading: 'Why the deadline matters',
      body: 'The timer records the exact moment each countdown should end and derives what is left from the clock, rather than counting its own ticks. Browsers slow down timers in tabs you are not watching, so a tick-counting timer would drift; here a sleeping tab wakes up already expired and the alerts fire immediately.',
    },
    {
      heading: 'Sound and notifications',
      body: 'When a timer reaches zero the panel beeps — a short two-tone chime built with the Web Audio API, so there is no asset file and nothing to download. Tick the notification box and your browser also raises a desktop notification, but only after you ask: the permission prompt appears on that click alone.',
    },
    {
      heading: 'Reading the summary',
      body: 'A summary table lists every timer with the duration you set, what is left, and whether it is running, paused or finished — in clock form (02:30) or in words (2 minutes 30 seconds).',
    },
    {
      heading: 'Privacy',
      body: 'Everything happens in this tab. Durations, names and remaining times are held in memory only, never written to storage and never sent anywhere. The chime is generated locally and notifications are issued by your own browser, so the page keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'Does a countdown keep running when I switch tabs?',
      a: 'Yes. Each timer stores the moment it should finish, and the remaining time is worked out from the clock on every tick. Background tabs are slowed down by the browser, but the timer still ends at the right second — and it catches up the instant you come back to the tab.',
    },
    {
      q: 'Can I run more than one timer at a time?',
      a: 'Yes — add as many as you like. Every timer has its own duration, its own Pause, Resume and Restart buttons, and its own sound and notification when it ends.',
    },
    {
      q: 'How does the sound work, and is anything downloaded?',
      a: 'The chime is generated in the browser with the Web Audio API, so there is no audio file to download and no network request. If your browser blocks audio until you interact with the page, add a timer once and the sound is unlocked for the rest of the visit.',
    },
    {
      q: 'Will I get a notification when a timer finishes?',
      a: 'Only if you switch notifications on. The permission prompt appears the moment you tick the box, never before, and you can turn it off again at any time. With it off, the timer still beeps and still shows the finished state on screen.',
    },
    {
      q: 'Are my timers saved?',
      a: 'No. They live in this tab only and are gone when you close or reload the page. Nothing about them is written to disk or sent anywhere.',
    },
  ],
} as const;
