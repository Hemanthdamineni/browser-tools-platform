/**
 * The Pomodoro timer report.
 *
 * The live countdown lives in the panel (`pomodoro-timer.astro`), which owns
 * the deadline-based timing. This module is the pure, unit-testable part that
 * runs when the panel asks for a session report: it reads the snapshot the
 * panel produced and describes the session — the current phase, how much is
 * left and the lifetime totals — as a small table.
 *
 * The tool works standalone too: hand it a session snapshot and it reports on
 * it, so the report logic never needs a DOM.
 */
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  formatClock,
  normalizeSettings,
  phaseLabel,
  remainingFor,
  type PomodoroSettings,
  type TimerSnapshot,
} from './pomodoro-timer.core';
import { meta } from './pomodoro-timer.meta';

/** Parse the session snapshot the panel produced. Throws a `ToolError` when it cannot. */
export function parseSnapshot(text: string): TimerSnapshot {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError('No timer session has been recorded yet.', 'Press Start on the timer above.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError('The timer session could not be read.', 'Reload the page and try again.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError('The timer session is not in the expected shape.', 'Reload the page and try again.');
  }
  const snapshot = parsed as Partial<TimerSnapshot>;
  const phase = snapshot.state?.phase;
  if (phase !== 'working' && phase !== 'shortBreak' && phase !== 'longBreak' && phase !== 'idle') {
    throw new ToolError('The timer session holds no valid phase.', 'Reload the page and try again.');
  }
  return snapshot as TimerSnapshot;
}

/** Build the session report from a snapshot and the declared settings. */
export function buildReport(
  snapshot: TimerSnapshot,
  settings: PomodoroSettings,
): { output: string; stats: Record<string, string | number>; notes: string[] } {
  const state = snapshot.state;
  const remaining = remainingFor(snapshot, Date.now());

  const rows: string[][] = [
    ['Phase', phaseLabel(state.phase)],
    ['Time left', formatClock(remaining)],
    ['Completed work phases', String(state.completedSessions)],
    [
      'Work phases this cycle',
      `${state.completedWork} / ${settings.cyclesBeforeLongBreak}`,
    ],
    ['Work', `${settings.workMinutes} min`],
    ['Short break', `${settings.shortBreakMinutes} min`],
    ['Long break', `${settings.longBreakMinutes} min`],
    ['Auto-start breaks', settings.autoStartBreaks ? 'on' : 'off'],
    ['Auto-start work', settings.autoStartWork ? 'on' : 'off'],
  ];

  const notes: string[] = [];
  if (state.phase === 'idle') {
    notes.push('The timer is ready — press Start to begin a work phase.');
  } else if (snapshot.running) {
    notes.push('The countdown is deadline-based, so it stays accurate even in a throttled tab.');
  } else {
    notes.push('The timer is paused.');
  }

  return {
    output: JSON.stringify({ headers: ['Setting', 'Value'], rows }),
    stats: {
      phase: phaseLabel(state.phase),
      timeLeft: formatClock(remaining),
      sessionsCompleted: state.completedSessions,
      workMinutes: settings.workMinutes,
      shortBreakMinutes: settings.shortBreakMinutes,
      longBreakMinutes: settings.longBreakMinutes,
      cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak,
    },
    notes,
  };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const settings = normalizeSettings({ ...o });
  const snapshot = parseSnapshot(input.text);
  const report = buildReport(snapshot, settings);
  return {
    output: report.output,
    render: 'table',
    stats: report.stats,
    notes: report.notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;