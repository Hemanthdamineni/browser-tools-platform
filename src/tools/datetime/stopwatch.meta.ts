import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'stopwatch',
  name: 'Stopwatch',
  category: 'datetime',
  summary:
    'A precise stopwatch with laps and keyboard shortcuts that stays accurate when the tab sleeps.',
  description:
    'A stopwatch that starts and pauses with the space bar and takes laps with the L key, with a live readout to the millisecond and a lap table that marks the fastest and slowest splits. Elapsed time is derived from timestamps rather than counted tick by tick, so it stays exact even when the tab sleeps, throttles or loses the foreground. Everything runs in this tab: nothing is recorded, stored or sent anywhere.',
  keywords: [
    'stopwatch',
    'lap timer',
    'lap splits',
    'online stopwatch',
    'timer',
    'elapsed time',
    'milliseconds',
    'split times',
    'chronometer',
    'keyboard shortcuts',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'stopwatch',
  options: [
    {
      key: 'includeSplits',
      label: "Show each lap's split in the report",
      type: 'boolean',
      default: true,
      help: 'A split is the time since the previous lap; the total is the running time when the lap was taken.',
    },
  ],
  examples: [
    {
      title: '5 km run — even splits',
      input:
        '{"running":false,"start":0,"accumulated":1770000,"laps":[{"atMs":345000,"splitMs":345000},{"atMs":702000,"splitMs":357000},{"atMs":1055000,"splitMs":353000},{"atMs":1412000,"splitMs":357000},{"atMs":1770000,"splitMs":358000}],"now":0}',
    },
    {
      title: 'Sprint intervals — tied splits',
      input:
        '{"running":false,"start":0,"accumulated":183300,"laps":[{"atMs":30000,"splitMs":30000},{"atMs":60800,"splitMs":30800},{"atMs":91200,"splitMs":30400},{"atMs":122000,"splitMs":30800},{"atMs":152500,"splitMs":30500},{"atMs":183300,"splitMs":30800}],"now":0}',
    },
    {
      title: 'A single lap',
      input:
        '{"running":false,"start":0,"accumulated":84500,"laps":[{"atMs":84500,"splitMs":84500}],"now":0}',
      options: { includeSplits: false },
    },
  ],
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
  related: ['duration-convert', 'timestamp', 'world-clock', 'date-diff'],
  status: 'stable',
};
