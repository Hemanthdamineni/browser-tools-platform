import { describe, expect, it } from 'vitest';
import tool, { buildReport, parseSnapshot } from './pomodoro-timer.tool';
import type { TextRunResult } from '@/lib/types';
import {
  DEFAULT_SETTINGS,
  initialState,
  normalizeSettings,
  openPhase,
  type PomodoroSettings,
  type StoredSession,
} from './pomodoro-timer.core';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as TextRunResult;

/** The snapshot JSON the panel hands to the tool. */
function snapshot(session: StoredSession, settings: PomodoroSettings): string {
  return JSON.stringify({ ...session, settings });
}

const SETTINGS: PomodoroSettings = {
  ...DEFAULT_SETTINGS,
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

/** Read one row out of the table the report produces. */
function valueOf(result: TextRunResult, key: string): string {
  const table = JSON.parse(result.output) as { headers: string[]; rows: string[][] };
  return table.rows.find((row) => row[0] === key)?.[1] ?? '';
}

describe('pomodoro-timer tool', () => {
  it('is a stable, on-device datetime tool with its own panel', () => {
    expect(tool.meta.id).toBe('pomodoro-timer');
    expect(tool.meta.category).toBe('datetime');
    expect(tool.meta.panel).toBe('pomodoro-timer');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(tool.meta.status).toBe('stable');
  });

  it('reports a paused work session as a table, with the exact time left', () => {
    // A paused session carries its own remaining time, so the report is
    // independent of the wall clock.
    const session: StoredSession = {
      state: { phase: 'working', completedWork: 2, completedSessions: 7 },
      remaining: 1_500_000,
      endAt: null,
      running: false,
    };
    const result = run(snapshot(session, SETTINGS));
    expect(result.render).toBe('table');
    const table = JSON.parse(result.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['Setting', 'Value']);
    expect(valueOf(result, 'Phase')).toBe('Work');
    expect(valueOf(result, 'Time left')).toBe('25:00');
    expect(valueOf(result, 'Completed work phases')).toBe('7');
    expect(valueOf(result, 'Work phases this cycle')).toBe('2 / 4');
    expect(valueOf(result, 'Work')).toBe('25 min');
    expect(result.stats?.sessionsCompleted).toBe(7);
    expect((result.notes ?? []).join(' ')).toMatch(/paused/i);
  });

  it('notes that a running session is deadline-based', () => {
    const session: StoredSession = {
      state: { phase: 'working', completedWork: 0, completedSessions: 1 },
      remaining: 0,
      endAt: Date.now() + 1_500_000,
      running: true,
    };
    const result = run(snapshot(session, SETTINGS));
    expect((result.notes ?? []).join(' ')).toMatch(/deadline-based/i);
    expect(result.stats?.timeLeft).toMatch(/^25:00$/);
  });

  it('reports a fresh idle timer with the ready note', () => {
    const session = openPhase(SETTINGS, initialState(), Date.now(), false);
    const result = run(snapshot(session, SETTINGS));
    expect(valueOf(result, 'Phase')).toBe('Ready');
    expect((result.notes ?? []).join(' ')).toMatch(/press start/i);
  });

  it('rejects empty input with a friendly error', () => {
    expect(() => run('')).toThrow(/no timer session/i);
    expect(() => run('   ')).toThrow(/no timer session/i);
  });

  it('rejects malformed or phase-less input', () => {
    expect(() => run('not json')).toThrow(/could not be read/i);
    expect(() => run('[]')).toThrow(/expected shape/i);
    expect(() => run('{"state":{"phase":"nope"}}')).toThrow(/no valid phase/i);
  });

  it('honours every option branch', () => {
    const session = openPhase(
      SETTINGS,
      { phase: 'shortBreak', completedWork: 0, completedSessions: 3 },
      Date.now(),
      false,
    );
    const result = run(snapshot(session, SETTINGS), {
      workMinutes: 30,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      cyclesBeforeLongBreak: 3,
      autoStartBreaks: true,
      autoStartWork: true,
    });
    expect(valueOf(result, 'Phase')).toBe('Short break');
    expect(valueOf(result, 'Work')).toBe('30 min');
    expect(valueOf(result, 'Short break')).toBe('10 min');
    expect(valueOf(result, 'Long break')).toBe('20 min');
    expect(valueOf(result, 'Work phases this cycle')).toBe('0 / 3');
    expect(valueOf(result, 'Auto-start breaks')).toBe('on');
    expect(valueOf(result, 'Auto-start work')).toBe('on');
  });

  it('clamps an out-of-range option rather than trusting it', () => {
    const session = openPhase(SETTINGS, initialState(), Date.now(), false);
    const result = run(snapshot(session, SETTINGS), { workMinutes: 1000, cyclesBeforeLongBreak: 0 });
    expect(valueOf(result, 'Work')).toBe('120 min');
    expect(valueOf(result, 'Work phases this cycle')).toBe('0 / 1');
  });

  it('parses a snapshot and builds a report without the panel', () => {
    const parsed = parseSnapshot(snapshot(openPhase(SETTINGS, initialState(), 0, false), SETTINGS));
    const report = buildReport(parsed, normalizeSettings({ workMinutes: '45' }));
    expect(JSON.parse(report.output).headers).toEqual(['Setting', 'Value']);
    expect(report.stats.workMinutes).toBe(45);
    expect(report.stats.phase).toBe('Ready');
  });
});