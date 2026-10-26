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
  related: ['duration-convert', 'timestamp', 'world-clock', 'date-diff'],
  status: 'stable',
};
