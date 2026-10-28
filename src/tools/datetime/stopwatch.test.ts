import { describe, it, expect, vi } from 'vitest';
import tool, {
  elapsedMs,
  emptyState,
  addLap,
  applyAction,
  parseClockTime,
  parseActions,
  replay,
  formatElapsed,
  bindShortcuts,
} from './stopwatch.tool';
import { start, pause, resume, reset } from './stopwatch.core';
import { ToolError } from '@/lib/types';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });

const table = (output: string) => JSON.parse(output) as { headers: string[]; rows: string[][] };

describe('elapsed from timestamps (no interval counting)', () => {
  it('derives elapsed purely from the observed instant', () => {
    let s = start(emptyState(), 0);
    // Simulate a tab that slept: the next observation is far in the future.
    s = { ...s }; // no ticks, no accumulation — state is immutable
    expect(elapsedMs(s, 90_000)).toBe(90_000);
    expect(elapsedMs(s, 3_600_000)).toBe(3_600_000);
  });

  it('keeps banked time across pause and resume, wherever resume lands', () => {
    let s = start(emptyState(), 0);
    s = pause(s, 10_000); // 10s banked
    expect(elapsedMs(s, 60_000)).toBe(10_000); // paused: later observation changes nothing
    s = resume(s, 500_000); // tab slept 8+ minutes before resume
    expect(elapsedMs(s, 505_000)).toBe(15_000); // 10s banked + 5s since resume
  });

  it('never reports negative elapsed', () => {
    const s = start(emptyState(), 10_000);
    expect(elapsedMs(s, 0)).toBe(0);
  });

  it('ignores start while running and pause/resume while stopped', () => {
    const s = start(emptyState(), 0);
    expect(start(s, 5_000)).toBe(s);
    const p = pause(emptyState(), 5_000);
    expect(pause(p, 6_000)).toBe(p);
    expect(resume(s, 6_000)).toBe(s);
  });
});

describe('laps', () => {
  it('records split and total per lap', () => {
    let s = start(emptyState(), 0);
    s = addLap(s, 12_340);
    s = addLap(s, 20_000);
    expect(s.laps).toEqual([
      { index: 1, splitMs: 12_340, totalMs: 12_340 },
      { index: 2, splitMs: 7_660, totalMs: 20_000 },
    ]);
  });

  it('laps survive a pause between them', () => {
    let s = start(emptyState(), 0);
    s = pause(s, 5_000);
    s = resume(s, 9_000);
    s = addLap(s, 11_000);
    expect(s.laps[0]).toMatchObject({ splitMs: 7_000, totalMs: 7_000 });
  });
});

describe('applyAction / reset', () => {
  it('applies each action kind', () => {
    let s = applyAction(emptyState(), { kind: 'start', at: 0 });
    expect(s.running).toBe(true);
    s = applyAction(s, { kind: 'lap', at: 3_000 });
    s = applyAction(s, { kind: 'pause', at: 4_000 });
    expect(s.running).toBe(false);
    s = applyAction(s, { kind: 'resume', at: 10_000 });
    expect(s.running).toBe(true);
    s = applyAction(s, { kind: 'reset', at: 11_000 });
    expect(s).toEqual(emptyState());
  });

  it('rejects unknown action kinds', () => {
    expect(() => applyAction(emptyState(), { kind: 'flap' as never, at: 0 })).toThrow(/unknown/);
  });
});

describe('parseClockTime', () => {
  it('parses HH:MM, HH:MM:SS and fractional seconds on the reference day', () => {
    expect(parseClockTime('13:30', NOW)).toBe(new Date(2026, 5, 1, 13, 30, 0, 0).getTime());
    expect(parseClockTime('13:30:15', NOW)).toBe(new Date(2026, 5, 1, 13, 30, 15, 0).getTime());
    expect(parseClockTime('13:30:15.25', NOW)).toBe(
      new Date(2026, 5, 1, 13, 30, 15, 250).getTime(),
    );
    expect(parseClockTime('13:30:15.250', NOW)).toBe(parseClockTime('13:30:15.25', NOW));
  });

  it('rejects malformed and out-of-range times', () => {
    expect(() => parseClockTime('25:00', NOW)).toThrow(/range/);
    expect(() => parseClockTime('13:60', NOW)).toThrow(/range/);
    expect(() => parseClockTime('noon', NOW)).toThrow(/parse/);
    expect(() => parseClockTime('', NOW)).toThrow(/parse/);
  });
});

describe('parseActions', () => {
  it('parses a full log, ignoring comments and blanks', () => {
    const actions = parseActions(
      '# warmup\nstart 10:00:00\n\nlap 10:00:15.250\npause 10:00:40\nresume 10:01:00\nlap 10:01:10\nreset',
      NOW,
    );
    expect(actions.map((a) => a.kind)).toEqual(['start', 'lap', 'pause', 'resume', 'lap', 'reset']);
    expect(actions[1]!.at).toBe(new Date(2026, 5, 1, 10, 0, 15, 250).getTime());
    expect(actions[5]!.at).toBe(NOW);
  });

  it('is case-insensitive', () => {
    expect(parseActions('START 10:00:00\nLap 10:00:05', NOW)[0]!.kind).toBe('start');
  });

  it('names the offending line', () => {
    expect(() => parseActions('start 10:00:00\nwat 10:00:05', NOW)).toThrow(/line 2/);
    expect(() => parseActions('lap', NOW)).toThrow(/line 1.*needs a time/);
  });
});

describe('replay', () => {
  it('replays a log to the final state and elapsed', () => {
    const actions = parseActions(
      'start 10:00:00\nlap 10:00:15.250\nlap 10:00:31\npause 10:00:40\nresume 10:01:00\nlap 10:01:10',
      NOW,
    );
    const r = replay(actions);
    expect(r.finalElapsedMs).toBe(50_000);
    expect(r.laps.map((l) => l.splitMs)).toEqual([15_250, 15_750, 19_000]);
    expect(r.laps.map((l) => l.totalMs)).toEqual([15_250, 31_000, 50_000]);
    expect(r.state.running).toBe(true);
  });

  it('a trailing reset leaves a clean slate', () => {
    const actions = parseActions('start 10:00:00\nlap 10:00:05\nreset 23:59:59', NOW);
    const r = replay(actions);
    expect(r.state).toEqual(emptyState());
    expect(r.finalElapsedMs).toBe(0);
    expect(r.laps).toEqual([]);
  });

  it('rejects out-of-order timestamps', () => {
    const actions = parseActions('start 10:00:10\nlap 10:00:05', NOW);
    expect(() => replay(actions)).toThrow(/time order/);
  });
});

describe('formatElapsed', () => {
  it('formats each precision with truncation (never rounding up)', () => {
    expect(formatElapsed(65_999, 'seconds')).toBe('01:05');
    expect(formatElapsed(65_999, 'centis')).toBe('01:05.99');
    expect(formatElapsed(65_999, 'millis')).toBe('01:05.999');
    expect(formatElapsed(65_999.9, 'millis')).toBe('01:05.999');
  });

  it('rolls hours into minutes and clamps negatives', () => {
    expect(formatElapsed(3_600_000, 'seconds')).toBe('60:00');
    expect(formatElapsed(0, 'centis')).toBe('00:00.00');
    expect(formatElapsed(-5, 'centis')).toBe('00:00.00');
  });

  it('defaults to centiseconds', () => {
    expect(formatElapsed(1_234)).toBe('00:01.23');
  });
});

describe('run', () => {
  it('renders the lap table with splits and totals', async () => {
    const r = await run(
      'start 10:00:00\nlap 10:00:15.250\nlap 10:00:31\npause 10:00:40\nresume 10:01:00\nlap 10:01:10',
    );
    expect(r.render).toBe('table');
    const t = table(r.output);
    expect(t.headers).toEqual(['Lap', 'Split', 'Total']);
    expect(t.rows[0]).toEqual(['1', '00:15.25', '00:15.25']);
    expect(t.rows[2]).toEqual(['3', '00:19.00', '00:50.00']);
    expect(r.stats?.Laps).toBe(3);
    expect(r.stats?.Elapsed).toBe('00:50.00');
    expect(r.stats?.State).toBe('running');
  });

  it('honors the precision option', async () => {
    const r = await run('start 10:00:00\nlap 10:00:01.234', { precision: 'millis' });
    expect(table(r.output).rows[0]).toEqual(['1', '00:01.234', '00:01.234']);
  });

  it('calls out the fastest lap when there is more than one', async () => {
    const r = await run('start 10:00:00\nlap 10:00:10\nlap 10:00:15');
    expect(r.notes?.join(' ')).toMatch(/Fastest lap: #2/);
  });

  it('empty input yields empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('comment-only input raises a ToolError', async () => {
    await expect(run('# nothing here')).rejects.toThrow(ToolError);
  });

  it('bad lines raise ToolError with the line number', async () => {
    await expect(run('start 10:00:00\nwat 10:00:05')).rejects.toThrow(/line 2/);
    await expect(run('start 10:00:00\nlap')).rejects.toThrow(/needs a time/);
  });

  it('out-of-order logs raise ToolError', async () => {
    await expect(run('start 10:00:10\nlap 10:00:05')).rejects.toThrow(ToolError);
  });

  it('a trailing reset reports the reset state', async () => {
    const r = await run('start 10:00:00\nreset 23:59:59');
    expect(r.render).toBeUndefined();
    expect(r.stats?.State).toBe('reset');
    expect(r.stats?.Elapsed).toBe('00:00.00');
  });
});

describe('bindShortcuts', () => {
  const keyEvent = (key: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent =>
    new KeyboardEvent('keydown', { key, bubbles: true, ...init });

  function harness() {
    const toggle = vi.fn();
    const lap = vi.fn();
    const reset = vi.fn();
    const detach = bindShortcuts(document, { toggle, lap, reset });
    return { toggle, lap, reset, detach };
  }

  it('maps Space, L and R to toggle/lap/reset', () => {
    const h = harness();
    document.body.dispatchEvent(keyEvent(' '));
    document.body.dispatchEvent(keyEvent('l'));
    document.body.dispatchEvent(keyEvent('R'));
    expect(h.toggle).toHaveBeenCalledTimes(1);
    expect(h.lap).toHaveBeenCalledTimes(1);
    expect(h.reset).toHaveBeenCalledTimes(1);
    h.detach();
  });

  it('ignores keys with modifiers held', () => {
    const h = harness();
    document.body.dispatchEvent(keyEvent(' ', { ctrlKey: true }));
    document.body.dispatchEvent(keyEvent('l', { metaKey: true }));
    document.body.dispatchEvent(keyEvent('r', { altKey: true }));
    expect(h.toggle).not.toHaveBeenCalled();
    expect(h.lap).not.toHaveBeenCalled();
    expect(h.reset).not.toHaveBeenCalled();
    h.detach();
  });

  it('ignores keys typed into inputs, textareas and contenteditable', () => {
    const h = harness();
    const input = document.createElement('input');
    document.body.appendChild(input);
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'true');
    document.body.appendChild(ce);
    for (const el of [input, ta, ce]) {
      el.dispatchEvent(keyEvent(' '));
      el.dispatchEvent(keyEvent('l'));
      el.dispatchEvent(keyEvent('r'));
    }
    expect(h.toggle).not.toHaveBeenCalled();
    expect(h.lap).not.toHaveBeenCalled();
    expect(h.reset).not.toHaveBeenCalled();
    h.detach();
    input.remove();
    ta.remove();
    ce.remove();
  });

  it('detaches cleanly', () => {
    const h = harness();
    h.detach();
    document.body.dispatchEvent(keyEvent(' '));
    expect(h.toggle).not.toHaveBeenCalled();
  });
});
