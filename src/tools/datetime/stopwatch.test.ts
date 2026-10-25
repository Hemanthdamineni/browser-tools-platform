import { describe, it, expect } from 'vitest';
import type { OptionValues } from '@/lib/types';
import tool from './stopwatch.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = async (text: string, options: OptionValues = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): { headers: string[]; rows: string[][] } =>
  JSON.parse(r.output) as { headers: string[]; rows: string[][] };

/** A finished 29:30.000 run with four laps. */
const finished = {
  running: false,
  start: 0,
  accumulated: 1770000,
  laps: [
    { atMs: 345000, splitMs: 345000 }, // 05:45.000
    { atMs: 702000, splitMs: 357000 }, // 05:57.000 (slowest)
    { atMs: 1055000, splitMs: 353000 }, // 05:53.000
    { atMs: 1770000, splitMs: 715000 }, // 11:55.000
  ],
  now: 0,
};

describe('stopwatch meta', () => {
  it('is a stable datetime tool that runs entirely on-device', () => {
    expect(tool.meta.id).toBe('stopwatch');
    expect(tool.meta.category).toBe('datetime');
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.panel).toBe('stopwatch');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('explains the timestamp-accurate behaviour in the FAQ', () => {
    const faq = tool.meta.faq ?? [];
    expect(faq.length).toBeGreaterThanOrEqual(3);
    expect(faq.map((f) => `${f.q} ${f.a}`).join(' ')).toMatch(/sleep/i);
  });
});

describe('stopwatch run', () => {
  it('reports the known-answer elapsed time and lap table', async () => {
    const r = await run(JSON.stringify(finished));
    const { headers, rows } = table(r);
    expect(headers).toEqual(['Lap', 'Split', 'Total']);
    expect(rows).toEqual([
      ['1', '00:05:45.000', '00:05:45.000'],
      ['2', '00:05:57.000', '00:11:42.000'],
      ['3', '00:05:53.000', '00:17:35.000'],
      ['4', '00:11:55.000', '00:29:30.000'],
    ]);
    expect(r.stats).toEqual({ elapsed: '00:29:30.000', laps: 4 });
  });

  it('handles an empty snapshot (fresh watch) as an empty report', async () => {
    const r = await run('');
    const { headers, rows } = table(r);
    expect(headers).toEqual(['Lap', 'Split', 'Total']);
    expect(rows).toEqual([]);
    expect(r.stats).toEqual({ elapsed: '00:00:00.000', laps: 0 });
    expect((r.notes ?? []).join(' ')).toMatch(/no laps/i);
  });

  it('drops the split column when includeSplits is false', async () => {
    const r = await run(JSON.stringify(finished), { includeSplits: false });
    expect(table(r).headers).toEqual(['Lap', 'Total']);
    expect(table(r).rows).toEqual([
      ['1', '00:05:45.000'],
      ['2', '00:11:42.000'],
      ['3', '00:17:35.000'],
      ['4', '00:29:30.000'],
    ]);
  });

  it('shows a running row while the watch is running', async () => {
    const snapshot = {
      running: true,
      start: 10_000,
      accumulated: 5000,
      laps: [],
      now: 65_250, // running for 55.250s
    };
    const r = await run(JSON.stringify(snapshot));
    const rows = table(r).rows;
    expect(rows).toEqual([['—', 'running', '00:01:00.250']]);
    expect(r.stats?.elapsed).toBe('00:01:00.250');
  });

  it('tolerates malformed snapshots and falls back to a fresh watch', async () => {
    for (const bad of ['not json', '[]', 'null', '{"laps":5}']) {
      const r = await run(bad);
      expect(r.stats).toEqual({ elapsed: '00:00:00.000', laps: 0 });
    }
  });
});
