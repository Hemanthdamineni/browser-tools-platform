import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

export interface PomodoroConfig {
  /** Length of one work phase, in minutes. */
  workMinutes: number;
  /** Length of a short break, in minutes. */
  breakMinutes: number;
  /** Length of the long break (replaces the short break every `longBreakEvery` work phases). */
  longBreakMinutes: number;
  /** Number of work phases after which a long break is taken. */
  longBreakEvery: number;
  /** Total number of work phases in the session. */
  cycles: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  cycles: 4,
};

export type PomodoroPhaseKind = 'work' | 'short-break' | 'long-break';

export interface PomodoroPhase {
  /** 1-based position in the schedule. */
  index: number;
  kind: PomodoroPhaseKind;
  /** Which work phase this is (1-based); undefined for breaks. */
  workNumber?: number;
  /** How many work phases are completed when this phase starts. */
  completedWork: number;
  label: string;
  /** Length of this phase in minutes. */
  minutes: number;
  /** Offset from session start in minutes. */
  startMinute: number;
  /** Notification fired when this phase begins. */
  notification: string;
}

export function validateConfig(config: PomodoroConfig): PomodoroConfig {
  const requireInt = (value: number, name: string, min: number, max: number): number => {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new ToolError(`${name} must be a whole number.`);
    }
    if (value < min || value > max) {
      throw new ToolError(`${name} must be between ${min} and ${max}.`);
    }
    return value;
  };
  const cfg: PomodoroConfig = {
    workMinutes: requireInt(config.workMinutes, 'Work length', 1, 120),
    breakMinutes: requireInt(config.breakMinutes, 'Short break', 1, 60),
    longBreakMinutes: requireInt(config.longBreakMinutes, 'Long break', 1, 90),
    longBreakEvery: requireInt(config.longBreakEvery, 'Long break interval', 1, 12),
    cycles: requireInt(config.cycles, 'Work phases', 1, 24),
  };
  if (cfg.longBreakEvery > cfg.cycles) {
    throw new ToolError(
      `Long break interval (${cfg.longBreakEvery}) cannot exceed the number of work phases (${cfg.cycles}).`,
    );
  }
  return cfg;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Build the full schedule for a session. Pure: the total session length is
 * derived from the config only.
 */
export function buildSchedule(config: PomodoroConfig): PomodoroPhase[] {
  const cfg = validateConfig(config);
  const phases: PomodoroPhase[] = [];
  let minute = 0;
  let completedWork = 0;

  for (let n = 1; n <= cfg.cycles; n++) {
    phases.push({
      index: phases.length + 1,
      kind: 'work',
      workNumber: n,
      completedWork,
      label: n === 1 ? 'Work 1' : `Work ${n}`,
      minutes: cfg.workMinutes,
      startMinute: minute,
      notification:
        n === 1
          ? `Pomodoro started: ${formatMinutes(cfg.workMinutes)} of focused work.`
          : `Break over — work phase ${n} of ${cfg.cycles} starts now (${formatMinutes(cfg.workMinutes)}).`,
    });
    completedWork = n;
    minute += cfg.workMinutes;

    if (n < cfg.cycles) {
      const isLong = cfg.longBreakEvery > 0 && n % cfg.longBreakEvery === 0;
      const kind: PomodoroPhaseKind = isLong ? 'long-break' : 'short-break';
      const minutes = isLong ? cfg.longBreakMinutes : cfg.breakMinutes;
      phases.push({
        index: phases.length + 1,
        kind,
        completedWork,
        label: isLong ? 'Long break' : 'Short break',
        minutes,
        startMinute: minute,
        notification: isLong
          ? `Work phase ${n} done. Time for a long break — ${formatMinutes(minutes)}.`
          : `Work phase ${n} done. Take a ${formatMinutes(minutes)} break.`,
      });
      minute += minutes;
    }
  }
  return phases;
}

export interface SessionSummary {
  totalMinutes: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  longBreaks: number;
  shortBreaks: number;
}

export function summarize(phases: PomodoroPhase[]): SessionSummary {
  let totalWorkMinutes = 0;
  let totalBreakMinutes = 0;
  let longBreaks = 0;
  let shortBreaks = 0;
  for (const p of phases) {
    if (p.kind === 'work') totalWorkMinutes += p.minutes;
    else {
      totalBreakMinutes += p.minutes;
      if (p.kind === 'long-break') longBreaks++;
      else shortBreaks++;
    }
  }
  return {
    totalMinutes: totalWorkMinutes + totalBreakMinutes,
    totalWorkMinutes,
    totalBreakMinutes,
    longBreaks,
    shortBreaks,
  };
}

/* -------------------------------------------------------------------------- */
/*  State machine                                                             */
/* -------------------------------------------------------------------------- */

export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface PomodoroState {
  config: PomodoroConfig;
  status: PomodoroStatus;
  /** Index into the schedule (0-based) of the current phase. */
  phaseIndex: number;
  /** Milliseconds of the current phase already consumed (across pauses). */
  elapsedMs: number;
  /** Total milliseconds consumed across all completed phases. */
  totalElapsedMs: number;
  /** Wall-clock timestamp of the last tick (ms epoch), used to advance on tick. */
  lastTickAt: number | null;
  completedWork: number;
  /** Set of phase indexes whose start notification has been emitted. */
  notified: number[];
}

export interface PomodoroEvent {
  type: 'phase-start' | 'phase-end' | 'session-end';
  phase: PomodoroPhase;
  notification: string;
}

export function initialState(config: PomodoroConfig): PomodoroState {
  return {
    config: validateConfig(config),
    status: 'idle',
    phaseIndex: 0,
    elapsedMs: 0,
    totalElapsedMs: 0,
    lastTickAt: null,
    completedWork: 0,
    notified: [],
  };
}

export function currentPhase(state: PomodoroState, schedule: PomodoroPhase[]): PomodoroPhase {
  const phase = schedule[state.phaseIndex];
  if (!phase) throw new ToolError('No current phase — the session is not running.');
  return phase;
}

export function remainingMs(state: PomodoroState, schedule: PomodoroPhase[]): number {
  const phase = schedule[state.phaseIndex];
  if (!phase) return 0;
  return Math.max(0, phase.minutes * 60_000 - state.elapsedMs);
}

/**
 * Advance the machine by `nowMs` (wall clock). Emits one event per transition:
 * each phase that starts fires `phase-start` (with its notification), each
 * completed phase fires `phase-end`, and running out of schedule fires
 * `session-end`. Pure — the next state is returned, the input is untouched.
 */
export function tick(
  state: PomodoroState,
  schedule: PomodoroPhase[],
  nowMs: number,
): { state: PomodoroState; events: PomodoroEvent[] } {
  if (state.status !== 'running' || state.lastTickAt === null) {
    return { state: { ...state, lastTickAt: nowMs }, events: [] };
  }
  const delta = Math.max(0, nowMs - state.lastTickAt);
  let s: PomodoroState = {
    ...state,
    lastTickAt: nowMs,
    elapsedMs: state.elapsedMs + delta,
    totalElapsedMs: state.totalElapsedMs + delta,
  };
  const events: PomodoroEvent[] = [];

  let guard = 0;
  while (guard++ < schedule.length + 1) {
    const phase = schedule[s.phaseIndex];
    if (!phase) break;
    const duration = phase.minutes * 60_000;
    if (s.elapsedMs < duration) break;
    // Phase completed. The transition notification itself belongs to the next
    // phase-start — phase-end only reports that the phase is over.
    events.push({ type: 'phase-end', phase, notification: `${phase.label} finished.` });
    if (phase.kind === 'work') {
      s = { ...s, completedWork: s.completedWork + 1 };
    }
    const next = schedule[s.phaseIndex + 1];
    if (!next) {
      events.push({
        type: 'session-end',
        phase,
        notification: `Session complete — ${s.completedWork} work phase${s.completedWork === 1 ? '' : 's'} done. Great job!`,
      });
      return { state: { ...s, status: 'finished' }, events };
    }
    s = {
      ...s,
      phaseIndex: s.phaseIndex + 1,
      elapsedMs: s.elapsedMs - duration,
      notified: s.notified.includes(next.index) ? s.notified : [...s.notified, next.index],
    };
    events.push({ type: 'phase-start', phase: next, notification: next.notification });
  }
  return { state: s, events };
}

export function start(
  state: PomodoroState,
  schedule: PomodoroPhase[],
  nowMs: number,
): { state: PomodoroState; events: PomodoroEvent[] } {
  if (state.status === 'finished') {
    throw new ToolError('The session is already finished — reset to start a new one.');
  }
  if (state.status === 'running') return { state, events: [] };
  const first = schedule[0];
  if (!first) throw new ToolError('Nothing to run — the schedule is empty.');
  const phase = schedule[state.phaseIndex];
  const events: PomodoroEvent[] = [];
  let notified = state.notified;
  if (phase && !notified.includes(phase.index)) {
    notified = [...notified, phase.index];
    events.push({ type: 'phase-start', phase, notification: phase.notification });
  }
  return {
    state: { ...state, status: 'running', lastTickAt: nowMs, notified },
    events,
  };
}

export function pause(state: PomodoroState, nowMs: number): PomodoroState {
  if (state.status !== 'running') return state;
  const delta = state.lastTickAt === null ? 0 : Math.max(0, nowMs - state.lastTickAt);
  return {
    ...state,
    status: 'paused',
    elapsedMs: state.elapsedMs + delta,
    totalElapsedMs: state.totalElapsedMs + delta,
    lastTickAt: null,
  };
}

export function skip(state: PomodoroState, schedule: PomodoroPhase[]): PomodoroState {
  if (state.status === 'finished') return state;
  const next = schedule[state.phaseIndex + 1];
  if (!next) {
    return { ...state, status: 'finished' };
  }
  return {
    ...state,
    phaseIndex: state.phaseIndex + 1,
    elapsedMs: 0,
    notified: state.notified.includes(next.index)
      ? state.notified
      : [...state.notified, next.index],
  };
}

export function reset(state: PomodoroState): PomodoroState {
  return initialState(state.config);
}
