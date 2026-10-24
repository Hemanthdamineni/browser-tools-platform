/**
 * Pure logic for the Pomodoro timer.
 *
 * The live countdown lives in the panel (`pomodoro-timer.astro`); this module
 * holds everything that does not need a DOM, so it can be unit-tested directly:
 *
 * - the phase state machine (`idle` → `working` → `shortBreak` / `longBreak` →
 *   `working` …), with the cycle counter and the next-phase computation,
 * - deadline-based remaining-time maths,
 * - settings normalisation and persistence (de)serialisation.
 *
 * Timing is **deadline-based**: instead of decrementing a counter on every tick
 * (which drifts when a backgrounded tab is throttled), the caller stores the
 * wall-clock deadline of the current phase and derives the remaining time from
 * `Date.now()` on every tick. A throttled or hidden tab therefore catches up
 * exactly when it wakes, with no accumulated drift.
 *
 * Nothing here touches `window`, `navigator`, `localStorage` or the network.
 */

/** The four phases of the timer. `idle` is the stopped, ready state. */
export type Phase = 'idle' | 'working' | 'shortBreak' | 'longBreak';

/** The user's timer settings. */
export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  notifyOnPhase: boolean;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

/** The state of a running (or stopped) timer. */
export interface PomodoroState {
  phase: Phase;
  /** Work phases completed since the last long break (0 … cyclesBeforeLongBreak). */
  completedWork: number;
  /** Total work phases completed — the session counter. */
  completedSessions: number;
}

/** A persisted session: the state machine, what is left and when it ends. */
export interface StoredSession {
  state: PomodoroState;
  /** Milliseconds left in the current phase; authoritative while paused. */
  remaining: number;
  /** Wall-clock deadline of the current phase, ms since epoch; null when paused or idle. */
  endAt: number | null;
  running: boolean;
}

/** The snapshot the panel hands to the tool's `run()` for a session report. */
export interface TimerSnapshot extends StoredSession {
  settings: PomodoroSettings;
}

/** Storage keys. Settings and the session are kept in this browser only. */
export const SETTINGS_KEY = 'pomodoro-timer.settings';
export const SESSION_KEY = 'pomodoro-timer.session';

/** The defaults, used when nothing has been stored yet. */
export const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  notifyOnPhase: false,
  autoStartBreaks: false,
  autoStartWork: false,
};

/** Clamp an integer into a range, falling back to a default for junk input. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Turn raw option values into complete, in-range settings. */
export function normalizeSettings(values: Record<string, unknown>): PomodoroSettings {
  return {
    workMinutes: clampInt(values.workMinutes, 1, 120, DEFAULT_SETTINGS.workMinutes),
    shortBreakMinutes: clampInt(
      values.shortBreakMinutes,
      1,
      60,
      DEFAULT_SETTINGS.shortBreakMinutes,
    ),
    longBreakMinutes: clampInt(values.longBreakMinutes, 1, 120, DEFAULT_SETTINGS.longBreakMinutes),
    cyclesBeforeLongBreak: clampInt(
      values.cyclesBeforeLongBreak,
      1,
      12,
      DEFAULT_SETTINGS.cyclesBeforeLongBreak,
    ),
    notifyOnPhase: values.notifyOnPhase === true,
    autoStartBreaks: values.autoStartBreaks === true,
    autoStartWork: values.autoStartWork === true,
  };
}

/** Parse persisted settings, tolerating a corrupt or missing entry. */
export function parseSettings(raw: string | null): PomodoroSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_SETTINGS };
    }
    return normalizeSettings(parsed as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** A type guard for the phase union — also narrows for the caller. */
export function isPhase(value: unknown): value is Phase {
  return value === 'idle' || value === 'working' || value === 'shortBreak' || value === 'longBreak';
}

/** Parse a persisted session, returning null when there is nothing usable. */
export function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const state = parsed.state as PomodoroState | undefined;
    if (!state || !isPhase(state.phase)) return null;
    const endAt =
      typeof parsed.endAt === 'number' && Number.isFinite(parsed.endAt) ? parsed.endAt : null;
    return {
      state: {
        phase: state.phase,
        completedWork: Math.max(0, Math.floor(Number(state.completedWork) || 0)),
        completedSessions: Math.max(0, Math.floor(Number(state.completedSessions) || 0)),
      },
      remaining: Math.max(0, Math.floor(Number(parsed.remaining) || 0)),
      endAt,
      running: parsed.running === true && endAt != null,
    };
  } catch {
    return null;
  }
}

/** The starting state of a freshly reset timer. */
export function initialState(): PomodoroState {
  return { phase: 'idle', completedWork: 0, completedSessions: 0 };
}

/** The duration of one phase, in milliseconds. */
export function phaseDurationMs(settings: PomodoroSettings, phase: Phase): number {
  switch (phase) {
    case 'working':
      return settings.workMinutes * 60_000;
    case 'shortBreak':
      return settings.shortBreakMinutes * 60_000;
    case 'longBreak':
      return settings.longBreakMinutes * 60_000;
    case 'idle':
      return 0;
  }
}

/**
 * Compute the phase that follows the current one when its time runs out:
 *
 * - `idle` → `working` (the first start);
 * - `working` → `shortBreak`, unless the work count has reached
 *   `cyclesBeforeLongBreak`, in which case it is the `longBreak` and the
 *   per-cycle work counter resets;
 * - `shortBreak` / `longBreak` → `working`.
 *
 * `completedSessions` increments every time a work phase finishes, so it is the
 * lifetime session counter.
 */
export function nextPhase(settings: PomodoroSettings, state: PomodoroState): PomodoroState {
  switch (state.phase) {
    case 'idle':
      return { ...state, phase: 'working' };
    case 'working': {
      const completedWork = state.completedWork + 1;
      const completedSessions = state.completedSessions + 1;
      if (completedWork >= settings.cyclesBeforeLongBreak) {
        return { phase: 'longBreak', completedWork: 0, completedSessions };
      }
      return { phase: 'shortBreak', completedWork, completedSessions };
    }
    case 'shortBreak':
    case 'longBreak':
      return { ...state, phase: 'working' };
  }
}

/** Open the next phase, either running from `now` or paused with its full length. */
export function openPhase(
  settings: PomodoroSettings,
  state: PomodoroState,
  now: number,
  running: boolean,
): StoredSession {
  const remaining = phaseDurationMs(settings, state.phase);
  return {
    state,
    remaining,
    endAt: running ? now + remaining : null,
    running: running && remaining > 0,
  };
}

/** Milliseconds left in a session as of `now`. */
export function remainingFor(session: StoredSession, now: number): number {
  if (session.running && session.endAt != null) return remainingMs(session.endAt, now);
  return Math.max(0, session.remaining);
}

/**
 * Bring a running session up to date as of `now`.
 *
 * If the deadline has passed, the current phase is completed exactly once and
 * the next phase opens. Only one phase is completed per call — a tab that was
 * away for an hour shows the next phase rather than silently fast-forwarding
 * through several of them.
 */
export function catchUp(
  session: StoredSession,
  settings: PomodoroSettings,
  now: number,
): { session: StoredSession; changed: boolean } {
  if (!session.running || session.endAt == null || remainingMs(session.endAt, now) > 0) {
    return { session, changed: false };
  }
  const state = nextPhase(settings, session.state);
  return { session: openPhase(settings, state, now, true), changed: true };
}

/**
 * Apply new settings without disturbing a phase that is already under way:
 * a running phase keeps its deadline (the new lengths take effect from the next
 * phase), a paused phase keeps what is left of it, and an idle timer adopts the
 * new work length straight away.
 */
export function applySettings(session: StoredSession, settings: PomodoroSettings): StoredSession {
  if (session.state.phase === 'idle') {
    return {
      state: session.state,
      remaining: phaseDurationMs(settings, 'working'),
      endAt: null,
      running: false,
    };
  }
  if (session.running) return session;
  const left = Math.min(session.remaining, phaseDurationMs(settings, session.state.phase));
  return { ...session, remaining: left, endAt: null, running: false };
}

/** A readable label for a phase. */
export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'working':
      return 'Work';
    case 'shortBreak':
      return 'Short break';
    case 'longBreak':
      return 'Long break';
    case 'idle':
      return 'Ready';
  }
}

/** Remaining milliseconds between a deadline and now, floored at zero. */
export function remainingMs(endAt: number, now: number): number {
  return Math.max(0, endAt - now);
}

/** Remaining whole seconds, rounded up so a fresh phase shows its full length. */
export function secondsLeft(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

/** Format a number of milliseconds as `MM:SS` (or `H:MM:SS` past an hour). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** The notification text for a phase change. */
export function notificationFor(previous: Phase, next: Phase): { title: string; body: string } {
  if (next === 'working') {
    return {
      title: previous === 'idle' ? 'Timer started' : 'Break over',
      body: 'Back to work — start your next focus session.',
    };
  }
  return {
    title: 'Break time',
    body:
      next === 'longBreak'
        ? 'Long break — step away from the screen.'
        : 'Short break — stretch and rest your eyes.',
  };
}

/** The JSON snapshot handed to the tool's `run()` for the session report. */
export function snapshotJson(snapshot: TimerSnapshot): string {
  return JSON.stringify(snapshot);
}