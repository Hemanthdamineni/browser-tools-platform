import { describe, expect, it } from 'vitest';
import type { OptionValues, TextRunResult } from '@/lib/types';
import {
  createTimer,
  parseDuration,
  snapshotTimers,
  type Timer,
} from '@/components/panels/countdown-timer-panel';
import tool from './countdown-timer.tool';

/** The tool input: a serialised snapshot of the panel's timers. */
const run = (timers: Timer[], now: number, options: OptionValues = {}): TextRunResult =>
  tool.run({ text: snapshotTimers(timers, now), options }) as TextRunResult;

/** A finished timer whose `endAt` is the moment it expired. */
const finishedAt = (id: string, label: string, durationMs: number, endAt: number): Timer => ({
  id,
  label,
  durationMs,
  endAt,
  pausedRemainingMs: 0,
  running: false,
  fired: true,
});

const NOW = 1_000_000;

const parse = (output: string) => JSON.parse(output) as { headers: string[]; rows: string[][] };

describe('countdown-timer tool', () => {
  it('is a stable datetime panel tool that runs entirely on-device', () => {
    expect(tool.meta.id).toBe('countdown-timer');
    expect(tool.meta.category).toBe('datetime');
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.panel).toBe('countdown-timer');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('reports a running timer with its remaining time', () => {
    const timer = createTimer('t1', 'Tea', parseDuration('90s'), NOW);
    const result = run([timer], NOW + 30_000);
    const table = parse(result.output);
    expect(result.render).toBe('table');
    expect(table.headers).toEqual(['Timer', 'Set', 'Remaining', 'State']);
    expect(table.rows).toEqual([['Tea', '01:30', '01:00', 'Running']]);
    expect(result.stats).toMatchObject({ timers: 1, running: 1, paused: 0, finished: 0 });
  });

  it('sorts finished timers most-recently-finished first and counts the states', () => {
    const tea = finishedAt('tea', 'Tea', 60_000, NOW - 120_000);
    const pasta = finishedAt('pasta', 'Pasta', 300_000, NOW - 30_000);
    const running = createTimer('run', 'Running', 60_000, NOW);
    const result = run([tea, running, pasta], NOW);
    const rows = parse(result.output).rows;
    expect(rows.map((row) => row[0])).toEqual(['Pasta', 'Tea', 'Running']);
    expect(rows[0]![3]).toBe('Finished');
    expect(rows[2]![3]).toBe('Running');
    expect(result.stats).toMatchObject({ timers: 3, running: 1, paused: 0, finished: 2 });
    expect((result.notes ?? []).join(' ')).toMatch(/Pasta, Tea/);
  });

  it('marks a paused timer as Paused', () => {
    const timer: Timer = {
      ...createTimer('t1', 'Eggs', 60_000, NOW),
      running: false,
      pausedRemainingMs: 45_000,
    };
    const result = run([timer], NOW);
    expect(parse(result.output).rows).toEqual([['Eggs', '01:00', '00:45', 'Paused']]);
    expect(result.stats).toMatchObject({ paused: 1, running: 0 });
  });

  it('writes the Set and Remaining columns in words when asked', () => {
    const timer = createTimer('t1', 'Tea', 90_000, NOW);
    const result = run([timer], NOW, { format: 'words' });
    expect(parse(result.output).rows).toEqual([
      ['Tea', '1 minute 30 seconds', '1 minute 30 seconds', 'Running'],
    ]);
  });

  it('reports the sound and notification options in the notes', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    const on = (run([timer], NOW, { sound: true, notify: true }).notes ?? []).join(' ');
    expect(on).toMatch(/Sound alerts are on/);
    expect(on).toMatch(/Desktop notifications are on/);
    const off = (run([timer], NOW, { sound: false, notify: false }).notes ?? []).join(' ');
    expect(off).not.toMatch(/Sound alerts are on/);
  });

  it('throws a friendly error when there is no snapshot', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/no timers/);
    expect(() => tool.run({ text: '   ', options: {} })).toThrow(/no timers/);
  });

  it('throws a friendly error for a malformed snapshot', () => {
    expect(() => tool.run({ text: 'not json', options: {} })).toThrow(/could not be read/);
    expect(() => tool.run({ text: '{"now":0}', options: {} })).toThrow(/expected shape/);
    expect(() => tool.run({ text: '[]', options: {} })).toThrow(/expected shape/);
  });
});
