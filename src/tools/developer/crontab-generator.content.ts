/**
 * Editorial content for the crontab-generator tool page.
 *
 * Kept out of ``crontab-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Presets or five fields',
      body: 'Pick a preset — every minute, every 5 or 15 minutes, hourly, daily, weekly or monthly — and the tool fills the classic five cron fields (minute, hour, day-of-month, month, day-of-week) for you. Choose “Custom fields” to type each field yourself. Either way you get the finished crontab line, optionally with a command appended after it, plus a plain-English sentence describing the schedule.',
    },
    {
      heading: 'Ranges, steps, lists and names',
      body: 'The custom fields accept everything a real crontab does: a list (1,15), a range (9-17), a step (*/5), and combined forms like 9-17/2. Month and weekday names are understood — JAN-AUG, MON-FRI — in either the custom fields or the value pickers, and each field is validated against its own legal range before anything is emitted, so a typo like 25 in the hour field is reported instead of silently producing a job that never runs.',
    },
    {
      heading: 'Why the English summary matters',
      body: 'Cron is notorious for quietly doing something other than you pictured — a weekly job that also fires because day-of-month was left at a value, or a step that skips an hour you cared about. The summary line restates the schedule in words so you can confirm intent before pasting the line into a crontab or a CI config, and it pairs well with cron-parser when you want the next run times.',
    },
    {
      heading: 'Scope and privacy',
      body: 'The generator describes schedules only; it does not run, schedule or contact anything, and it does not expand a job to individual fire times. Everything is computed locally from your inputs with no request or upload, so the page works offline and your commands and paths stay on your device.',
    },
  ],
  faq: [
    {
      q: 'What do the five fields mean?',
      a: 'minute hour day-of-month month day-of-week. Steps, ranges and lists work: */5, 9-17, 1,15, MON-FRI, JAN. The tool validates them and flags bad input.',
    },
    {
      q: 'How do "every minute" and "hourly" differ?',
      a: 'Every minute is * * * * *; every 5 minutes is */5 * * * *; hourly at minute m is m * * * *. Presets set these for you, and custom lets you tweak any field directly.',
    },
    {
      q: 'Why show a summary?',
      a: 'Cron syntax is easy to tie in knots. The plain-English summary confirms what you actually scheduled before you save it, complementing cron-parser for next-run times.',
    },
  ],
} as const;
