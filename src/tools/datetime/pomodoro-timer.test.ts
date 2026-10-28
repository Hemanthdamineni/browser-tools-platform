import { describe, it, expect } from 'vitest';
import type { TextRunResult } from '@/lib/types';
import {
  validateConfig,
  buildSchedule,
  summarize,
  formatMinutes,
  formatClock,
  initialState,
  start,
  tick,
  pause,
  skip,
  reset,
  remainingMs,
  currentPhase,
  DEFAULT_CONFIG,
  type PomodoroState,
} from './pomodoro-timer.core';
import { ToolError } from '@/lib/types';
import toolModule from './pomodoro-timer.tool';

const MIN = 60_000;

describe('pomodoro-timer config validation', () => {
  it('accepts the defaults', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
  });

  it('rejects non-integer and out-of-range values', () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, workMinutes: 0 })).toThrow(ToolError);
    expect(() => validateConfig({ ...DEFAULT_CONFIG, workMinutes: 25.5 })).toThrow(ToolError);
    expect(() => validateConfig({ ...DEFAULT_CONFIG, breakMinutes: 0 })).toThrow(ToolError);
    expect(() => validateConfig({ ...DEFAULT_CONFIG, cycles: 0 })).toThrow(ToolError);
    expect(() => validateConfig({ ...DEFAULT_CONFIG, longBreakEvery: 0 })).toThrow(ToolError);
    expect(() => validateConfig({ ...DEFAULT_CONFIG, cycles: 99 })).toThrow(ToolError);
  });

  it('rejects a long-break interval larger than the cycle count', () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, longBreakEvery: 6, cycles: 4 })).toThrow(
      /cannot exceed/,
    );
  });
});

describe('pomodoro-timer schedule', () => {
  it('builds the classic 25/5 schedule with a long break after 4', () => {
    const phases = buildSchedule({
      workMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      longBreakEvery: 4,
      cycles: 4,
    });
    expect(phases.map((p) => p.kind)).toEqual([
      'work',
      'short-break',
      'work',
      'short-break',
      'work',
      'short-break',
      'work',
    ]);
    expect(phases.map((p) => p.minutes)).toEqual([25, 5, 25, 5, 25, 5, 25]);
    expect(phases[0]!.startMinute).toBe(0);
    expect(phases[1]!.startMinute).toBe(25);
    expect(phases[6]!.startMinute).toBe(90); // 3 work (75m) + 2 short breaks (10m) + 5m… = 25+5+25+5+25+5
    const s = summarize(phases);
    expect(s.totalWorkMinutes).toBe(100);
    expect(s.totalBreakMinutes).toBe(15);
    expect(s.totalMinutes).toBe(115);
    expect(s.shortBreaks).toBe(3);
    expect(s.longBreaks).toBe(0);
  });

  it('inserts the long break after longBreakEvery work phases', () => {
    const phases = buildSchedule({
      workMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      longBreakEvery: 2,
      cycles: 5,
    });
    const kinds = phases.filter((p) => p.kind !== 'work').map((p) => p.kind);
    expect(kinds).toEqual(['short-break', 'long-break', 'short-break', 'long-break']); // short after work 1/3, long after work 2/4
    const long = phases.find((p) => p.kind === 'long-break');
    expect(long!.minutes).toBe(15);
    expect(long!.completedWork).toBe(2);
  });

  it('has no break after the final work phase', () => {
    const phases = buildSchedule({ ...DEFAULT_CONFIG, longBreakEvery: 2, cycles: 2 });
    expect(phases[phases.length - 1]!.kind).toBe('work');
  });

  it('supports a single work phase with no breaks', () => {
    const phases = buildSchedule({ ...DEFAULT_CONFIG, cycles: 1, longBreakEvery: 1 });
    expect(phases).toHaveLength(1);
    expect(summarize(phases).totalMinutes).toBe(25);
  });

  it('gives every phase a non-empty notification', () => {
    for (const p of buildSchedule({ ...DEFAULT_CONFIG, cycles: 6, longBreakEvery: 3 })) {
      expect(p.notification.length).toBeGreaterThan(0);
    }
  });

  it('propagates ToolError for invalid configs', () => {
    expect(() => buildSchedule({ ...DEFAULT_CONFIG, workMinutes: 0 })).toThrow(ToolError);
  });
});

describe('pomodoro-timer formatting', () => {
  it('formats minutes', () => {
    expect(formatMinutes(25)).toBe('25m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(75)).toBe('1h 15m');
  });

  it('formats clock offsets', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(25)).toBe('00:25');
    expect(formatClock(125)).toBe('02:05');
  });
});

describe('pomodoro-timer state machine', () => {
  const schedule = buildSchedule({
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    cycles: 4,
  });
  const workMs = 25 * MIN;

  it('starts idle and fires the first phase notification on start', () => {
    const s0 = initialState(DEFAULT_CONFIG);
    expect(s0.status).toBe('idle');
    const { state, events } = start(s0, schedule, 1000);
    expect(state.status).toBe('running');
    expect(state.lastTickAt).toBe(1000);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('phase-start');
    expect(events[0]!.phase.kind).toBe('work');
  });

  it('start is idempotent while running', () => {
    const { state } = start(initialState(DEFAULT_CONFIG), schedule, 1000);
    const again = start(state, schedule, 2000);
    expect(again.events).toHaveLength(0);
    expect(again.state.lastTickAt).toBe(1000); // untouched — already running
  });

  it('does not advance while paused or idle', () => {
    const running = start(initialState(DEFAULT_CONFIG), schedule, 1000).state;
    const paused = pause(running, 6000);
    expect(paused.status).toBe('paused');
    expect(paused.elapsedMs).toBe(5000);
    const t = tick(paused, schedule, 61_000);
    expect(t.events).toHaveLength(0);
    expect(t.state.elapsedMs).toBe(5000);
  });

  it('emits phase-end and phase-start when a phase completes', () => {
    const t0 = 1000;
    let { state } = start(initialState(DEFAULT_CONFIG), schedule, t0);
    const r = tick(state, schedule, t0 + workMs + 1);
    state = r.state;
    expect(r.events.map((e) => e.type)).toEqual(['phase-end', 'phase-start']);
    expect(r.events[0]!.phase.kind).toBe('work');
    expect(r.events[1]!.phase.kind).toBe('short-break');
    expect(state.phaseIndex).toBe(1);
    expect(state.elapsedMs).toBe(1);
  });

  it('counts completed work phases and finishes after the last one', () => {
    let state: PomodoroState = start(initialState(DEFAULT_CONFIG), schedule, 0).state;
    let endEvent = null as null | string;
    // Drive the whole session one minute at a time.
    for (let now = MIN; now <= 115 * MIN + MIN; now += MIN) {
      const r = tick(state, schedule, now);
      state = r.state;
      const end = r.events.find((e) => e.type === 'session-end');
      if (end) {
        endEvent = end.notification;
        break;
      }
    }
    expect(state.status).toBe('finished');
    expect(state.completedWork).toBe(4);
    expect(endEvent).toMatch(/Session complete/);
  });

  it('finish notification states the work count with correct pluralisation', () => {
    const single = buildSchedule({ ...DEFAULT_CONFIG, cycles: 1, longBreakEvery: 1 });
    let state = start(
      initialState({ ...DEFAULT_CONFIG, cycles: 1, longBreakEvery: 1 }),
      single,
      0,
    ).state;
    const r = tick(state, single, 25 * MIN + 1);
    const end = r.events.find((e) => e.type === 'session-end');
    expect(end!.notification).toBe('Session complete — 1 work phase done. Great job!');
    expect(r.state.status).toBe('finished');
  });

  it('pause freezes elapsed time and start resumes', () => {
    const running = start(initialState(DEFAULT_CONFIG), schedule, 0).state;
    const afterWork = tick(running, schedule, workMs + 1).state;
    const paused = pause(afterWork, workMs + 1 + 2000);
    expect(paused.elapsedMs).toBe(1 + 2000);
    const resumed = start(paused, schedule, workMs + 1 + 10_000).state;
    expect(resumed.status).toBe('running');
    expect(resumed.lastTickAt).toBe(workMs + 1 + 10_000);
    expect(resumed.elapsedMs).toBe(1 + 2000); // unchanged until the next tick
  });

  it('skip advances to the next phase with a fresh timer and finishes at the end', () => {
    const running = start(initialState(DEFAULT_CONFIG), schedule, 0).state;
    const skipped = skip(running, schedule);
    expect(skipped.phaseIndex).toBe(1);
    expect(skipped.elapsedMs).toBe(0);
    expect(currentPhase(skipped, schedule).kind).toBe('short-break');

    // Skip through to the end.
    let s = skipped;
    for (let i = 0; i < schedule.length; i++) s = skip(s, schedule);
    expect(s.status).toBe('finished');
  });

  it('skip is a no-op when finished', () => {
    const s = skip({ ...initialState(DEFAULT_CONFIG), status: 'finished' }, schedule);
    expect(s.status).toBe('finished');
    expect(s.phaseIndex).toBe(0);
  });

  it('reset returns to a fresh idle state with the same config', () => {
    const running = start(initialState(DEFAULT_CONFIG), schedule, 0).state;
    const r = reset(tick(running, schedule, workMs).state);
    expect(r.status).toBe('idle');
    expect(r.phaseIndex).toBe(0);
    expect(r.elapsedMs).toBe(0);
    expect(r.config).toEqual(DEFAULT_CONFIG);
  });

  it('remainingMs never goes negative and reports zero when finished', () => {
    const running = start(initialState(DEFAULT_CONFIG), schedule, 0).state;
    expect(remainingMs(running, schedule)).toBe(workMs);
    const half = tick(running, schedule, workMs / 2).state;
    expect(remainingMs(half, schedule)).toBe(workMs / 2);
    expect(
      remainingMs({ ...running, status: 'finished', phaseIndex: schedule.length }, schedule),
    ).toBe(0);
  });

  it('currentPhase throws for a finished session', () => {
    expect(() =>
      currentPhase({ ...initialState(DEFAULT_CONFIG), phaseIndex: schedule.length }, schedule),
    ).toThrow(ToolError);
  });

  it('emits every transition notification exactly once', () => {
    const started = start(initialState(DEFAULT_CONFIG), schedule, 0);
    let state = started.state;
    const seen: string[] = started.events.map((e) => e.notification);
    for (let now = MIN; now <= 115 * MIN + 2 * MIN; now += MIN) {
      const r = tick(state, schedule, now);
      state = r.state;
      for (const e of r.events) seen.push(e.notification);
      if (state.status === 'finished') break;
    }
    for (const p of schedule) {
      expect(seen.filter((n) => n === p.notification)).toHaveLength(1);
    }
  });
});

describe('pomodoro-timer tool module', () => {
  const tool = async (
    text: string,
    options: Record<string, string | number | boolean> = {},
  ): Promise<{
    output: string;
    render?: TextRunResult['render'];
    notes?: string[];
    warnings?: string[];
    stats?: Record<string, string | number>;
  }> => await toolModule.run({ text, options });

  it('renders a table of phases with defaults', async () => {
    const r = await tool('');
    expect(r.render).toBe('table');
    const parsed = JSON.parse(r.output) as { headers: string[]; rows: string[][] };
    expect(parsed.headers).toEqual(['#', 'Phase', 'Start', 'Length', 'End', 'Notification']);
    expect(parsed.rows).toHaveLength(7); // 4 work + 3 short breaks
    expect(parsed.rows[0]![1]).toBe('Work 1');
    expect(parsed.rows[1]![2]).toBe('00:25');
  });

  it('honours custom options (52/17 rhythm)', async () => {
    const r = await tool('', { workMinutes: 52, breakMinutes: 17, longBreakEvery: 2, cycles: 3 });
    const parsed = JSON.parse(r.output) as { rows: string[][] };
    const lengths = parsed.rows.filter((row) => row[0] !== '—').map((row) => row[3]);
    expect(lengths).toEqual(['52m', '17m', '52m', '15m', '52m']);
    expect(r.stats?.['Focus time']).toBe('2h 36m');
  });

  it('summarises totals in notes and stats', async () => {
    const r = await tool('');
    expect(r.notes!.some((n) => n.includes('115m') || n.includes('1h 55m'))).toBe(true);
    expect(r.stats?.['Total time']).toBe('1h 55m');
  });

  it('includes the optional text as a session title row', async () => {
    const r = await tool('Deep work sprint');
    const parsed = JSON.parse(r.output) as { rows: string[][] };
    expect(parsed.rows[0]!.join(' ')).toContain('Deep work sprint');
  });

  it('warns when the long break is not longer than the short break', async () => {
    const r = await tool('', { longBreakMinutes: 5 });
    expect(r.warnings!.some((w) => w.includes('not longer'))).toBe(true);
  });

  it('rejects invalid configs with ToolError', async () => {
    await expect(tool('', { workMinutes: 0 })).rejects.toThrow(ToolError);
    await expect(tool('', { longBreakEvery: 6, cycles: 4 })).rejects.toThrow(/cannot exceed/);
  });
});
