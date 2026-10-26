/**
 * Editorial content for the stopwatch tool page.
 *
 * Kept out of ``stopwatch.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the panel and the report show',
      body: 'Start and pause share one button or the space bar, Lap is a button or the L key, and Copy all dumps the run as plain text. The report under the panel renders the same snapshot as a table: one row per lap with its split and total, a running row while the watch is still going, and a note when no lap has been taken yet.',
    },
    {
      heading: 'Timing that survives a sleeping tab',
      body: 'Elapsed time is never accumulated tick by tick. Each run stores the timestamp it began at, and every frame subtracts that from the current time, so a throttled background tab or a machine that slept for an hour is accounted for in one step, with no drift and no lost interval.',
    },
    {
      heading: 'Splits, records and the one option',
      body: 'A lap row carries the split — the time since the previous lap — and the total the watch read when the lap was taken. Once two laps exist, the shortest and longest splits are marked, ties included. The includeSplits option only adds or removes the Split column in the report table — the fastest and slowest marks are unaffected, and the text written by Copy all always keeps its splits.',
    },
    {
      heading: 'Nothing stored, nothing sent',
      body: 'The watch is a timestamp loop in this tab: laps live in memory, there is no storage, no account and no request, and a reload clears the run unless you copied it first. Accuracy follows the system clock and the frame rate — fine for training or billable hours, not a measurement instrument.',
    },
  ],
  faq: [
    {
      q: 'What are the keyboard shortcuts?',
      a: 'Space starts and pauses the watch, and L takes a lap while it is running. The shortcuts are ignored while you are typing into a field. Reset and Copy all are buttons, so nothing destructive happens by accident.',
    },
    {
      q: 'Does it keep time if I switch tabs or the screen turns off?',
      a: 'Yes. Elapsed time is computed from timestamps, not by counting ticks, so a throttled background tab or a sleeping machine is accounted for exactly. When you come back, the readout jumps straight to the true elapsed time.',
    },
    {
      q: 'What is the difference between a split and a total?',
      a: 'The split is the time of that lap on its own — since the previous lap, or since the start for the first one. The total is the time on the watch when the lap was taken. The fastest and slowest marks compare splits, not totals.',
    },
    {
      q: 'Are my laps saved?',
      a: 'No. There is no storage and no network: laps exist only in this tab and are gone when you reload. Copy all puts the whole run on your clipboard so you can paste it into your own notes.',
    },
  ],
} as const;
