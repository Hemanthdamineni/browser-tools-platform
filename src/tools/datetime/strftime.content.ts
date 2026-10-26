/**
 * Editorial content for the strftime tool page.
 *
 * Kept out of ``strftime.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A token language for formatting one instant',
      body: 'You give the formatter a pattern such as %Y-%m-%d %H:%M:%S and it substitutes each directive from the chosen moment. Year, month, day, clock fields, weekday and month names, the AM/PM marker, day of year (%j), Sunday- and Monday-based week numbers (%U and %W), Unix time (%s) and the zone offset (%z, %Z) are all covered, plus the composite shorthands %F, %D, %R, %T, %x and %X.',
    },
    {
      heading: 'Choosing the instant and the zone',
      body: 'Leave the timestamp field empty to format the current moment. Enter a Unix timestamp in whole seconds — not milliseconds — to format a specific instant, and tick Use UTC for output that does not depend on your machine: epoch 0 then reads 1970-01-01 00:00:00 and %s returns exactly the number you supplied.',
    },
    {
      heading: 'Unknown tokens are kept and flagged',
      body: 'Anything the formatter does not recognise, such as %q, is emitted exactly as written and listed in the notes, so a typo is visible rather than silently swallowed. A literal percent sign is written as %%, and a lone % before an unknown letter is one of the flagged cases. The date is never adjusted to make a token work.',
    },
    {
      heading: 'Formatting is pure local arithmetic',
      body: 'The conversion is arithmetic on a JavaScript Date object inside this tab. Your timestamp or pattern is never sent anywhere, no request is made and no account is needed, and the result is identical whether the browser is online or offline.',
    },
  ],
  faq: [
    {
      q: 'Which strftime tokens are supported?',
      a: 'Year (%Y %y), month (%m, %b, %B), day (%d, %e, %j), weekday (%a, %A, %w, %u), hour (%H, %I, %p, %P), minute/second (%M %S), week numbers (%U Sunday-based, %W Monday-based), Unix time (%s) and zone (%z, %Z). Composite shorthands %c, %D, %F, %R, %T, %x, %X are expanded, and %% is a literal percent.',
    },
    {
      q: 'What happens to an unknown token?',
      a: 'It is left exactly as written (e.g. "%q" stays "%q") and listed in the notes so you can spot typos.',
    },
    {
      q: 'Can I format a specific past or future date?',
      a: 'Yes — put the Unix timestamp (seconds, not milliseconds) in the timestamp field. The epoch 0 formats 1970-01-01 00:00:00 UTC. Use UTC for fully deterministic output.',
    },
  ],
} as const;
