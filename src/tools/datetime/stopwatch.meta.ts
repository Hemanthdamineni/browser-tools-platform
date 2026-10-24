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
      heading: 'What the stopwatch does',
      body: 'The panel shows a live readout to the millisecond, with Start, Lap, Reset and Copy all controls. Starting and pausing is one button (or the space bar); each lap is stamped with the split since the previous lap and the running total. When two or more laps have been taken, the shortest and longest splits are marked in the lap table.',
    },
    {
      heading: 'Accurate even when the tab sleeps',
      body: 'The elapsed time is never built by adding up ticks. Each run stores the timestamp it began at, and every frame simply subtracts that from the current timestamp. If the browser throttles the page, or the machine sleeps for an hour, the next frame computes the correct total in one step — there is no accumulated rounding error and no lost interval.',
    },
    {
      heading: 'Reading the lap table',
      body: 'Each row is one lap: the split is the time since the previous lap, and the total is how long the watch had been running when the lap was taken. The fastest split is marked as well as the slowest, and every lap that ties for either record is marked too. A single lap is never labelled: there is nothing to compare it with.',
    },
    {
      heading: 'Privacy and limits',
      body: 'The watch is a plain timestamp loop in this tab — no request, no storage, no account. Laps live only in memory, so a reload clears them; use Copy all to keep the run. Timing is as accurate as the operating system clock and the browser frame rate, which suits training, cooking and billable hours but not scientific measurement.',
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
