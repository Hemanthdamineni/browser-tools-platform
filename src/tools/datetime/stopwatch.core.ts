/**
 * Pure logic for the stopwatch tool: a timestamp-based elapsed-time model with
 * laps and an action-log replay for tests. No DOM, no interval accumulation —
 * elapsed is always (now − startTime) + pausedTotal, so it stays correct when
 * the tab is throttled or asleep.
 */

export type Precision = 'centis' | 'millis' | 'seconds';

export type ActionKind = 'start' | 'pause' | 'resume' | 'lap' | 'reset';

export interface Action {
  kind: ActionKind;
  /** Epoch milliseconds at which the action happened. */
  at: number;
}

export interface Lap {
  /** 1-based lap number. */
  index: number;
  /** Time since the previous lap (or since start), in milliseconds. */
  splitMs: number;
  /** Total elapsed time at the moment the lap was recorded, in milliseconds. */
  totalMs: number;
}

export interface StopwatchState {
  /** Whether the stopwatch is currently running. */
  running: boolean;
  /** Epoch ms of the current run segment's start; null while paused/reset. */
  segmentStart: number | null;
  /** Milliseconds banked from completed run segments. */
  pausedTotal: number;
  laps: Lap[];
}

export const emptyState = (): StopwatchState => ({
  running: false,
  segmentStart: null,
  pausedTotal: 0,
  laps: [],
});

/** Elapsed milliseconds for a state observed at instant `now`. */
export function elapsedMs(state: StopwatchState, now: number): number {
  const live = state.running && state.segmentStart !== null ? now - state.segmentStart : 0;
  return Math.max(0, state.pausedTotal + live);
}

export function start(state: StopwatchState, now: number): StopwatchState {
  if (state.running) return state;
  return { ...state, running: true, segmentStart: now };
}

export function pause(state: StopwatchState, now: number): StopwatchState {
  if (!state.running || state.segmentStart === null) return state;
  return {
    ...state,
    running: false,
    segmentStart: null,
    pausedTotal: state.pausedTotal + Math.max(0, now - state.segmentStart),
  };
}

/** Resume a paused stopwatch. `now` shifts the segment so banked time is preserved. */
export function resume(state: StopwatchState, now: number): StopwatchState {
  if (state.running) return state;
  return { ...state, running: true, segmentStart: now };
}

/** Record a lap at instant `now` (laps may also be taken while paused). */
export function addLap(state: StopwatchState, now: number): StopwatchState {
  const total = elapsedMs(state, now);
  const prevTotal = state.laps.length > 0 ? state.laps[state.laps.length - 1]!.totalMs : 0;
  const lap: Lap = {
    index: state.laps.length + 1,
    splitMs: Math.max(0, total - prevTotal),
    totalMs: total,
  };
  return { ...state, laps: [...state.laps, lap] };
}

export function reset(_state: StopwatchState): StopwatchState {
  return emptyState();
}

/**
 * Apply one action to a state. Unknown kinds throw so a malformed log fails
 * loudly instead of silently changing the timeline.
 */
export function applyAction(state: StopwatchState, action: Action): StopwatchState {
  switch (action.kind) {
    case 'start':
      return start(state, action.at);
    case 'pause':
      return pause(state, action.at);
    case 'resume':
      return resume(state, action.at);
    case 'lap':
      return addLap(state, action.at);
    case 'reset':
      return reset(state);
    default: {
      const never: never = action.kind;
      throw new Error(`unknown stopwatch action: ${String(never)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Parsing                                                                    */
/* -------------------------------------------------------------------------- */

/** Actions are case-insensitive; timestamps must parse as a real date. */
const ACTION_RE = /^\s*(start|pause|resume|lap|reset)\s*(.*)$/i;

/**
 * Parse a wall-clock time into epoch ms relative to a reference instant.
 * Accepted forms: `HH:MM`, `HH:MM:SS`, `HH:MM:SS.mmm`, `HH:MM:SS.cc` —
 * interpreted on the same calendar day as `reference` (local time).
 */
export function parseClockTime(text: string, reference: number): number {
  const t = text.trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(t);
  if (!m) throw new Error(`cannot parse time: ${text}`);

  const ref = new Date(reference);
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = m[3] !== undefined ? Number(m[3]) : 0;
  const frac = m[4] !== undefined ? Number(m[4].padEnd(3, '0')) : 0;
  if (h > 23 || min > 59 || s > 59) throw new Error(`time out of range: ${text}`);

  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), h, min, s, frac);
  if (isNaN(d.getTime())) throw new Error(`cannot parse time: ${text}`);
  return d.getTime();
}

/**
 * Parse the multi-line action log. Lines are `<action> [HH:MM[:SS[.fff]]]`;
 * `reset` may omit the time. Lines that are blank or start with `#` are
 * ignored. Throws with a line number on the first bad line.
 */
export function parseActions(text: string, reference: number): Action[] {
  const actions: Action[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const m = ACTION_RE.exec(line);
    if (!m)
      throw new Error(
        `line ${i + 1}: expected "start|pause|resume|lap|reset [HH:MM:SS]", got "${line}"`,
      );
    const kind = m[1]!.toLowerCase() as ActionKind;
    const timeText = (m[2] ?? '').trim();

    let at: number;
    if (!timeText) {
      if (kind !== 'reset') {
        throw new Error(`line ${i + 1}: "${kind}" needs a time, e.g. "${kind} 10:00:00"`);
      }
      at = reference;
    } else {
      at = parseClockTime(timeText, reference);
    }
    actions.push({ kind, at });
  }
  return actions;
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/**
 * Format milliseconds as MM:SS, MM:SS.cc or MM:SS.mmm. Hours roll into the
 * minutes field (a stopwatch reads 75:00, not 1:15:00). Sub-second digits are
 * truncated, never rounded, so the readout never runs ahead of the clock.
 */
export function formatElapsed(ms: number, precision: Precision = 'centis'): string {
  const t = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(t / 60_000);
  const seconds = Math.floor((t % 60_000) / 1000);
  const base = `${pad(minutes)}:${pad(seconds)}`;
  if (precision === 'seconds') return base;
  const frac = t % 1000;
  return precision === 'millis'
    ? `${base}.${pad(frac, 3)}`
    : `${base}.${pad(Math.floor(frac / 10))}`;
}

/* -------------------------------------------------------------------------- */
/*  Replay                                                                     */
/* -------------------------------------------------------------------------- */

export interface ReplayResult {
  /** Final state after every action. */
  state: StopwatchState;
  /** Elapsed at the last action (0 when the log ends in a reset). */
  finalElapsedMs: number;
  laps: Lap[];
}

/**
 * Replay a parsed action log in order and report the resulting state. Times
 * must be non-decreasing; a line earlier than its predecessor is rejected so
 * a garbled log cannot produce negative splits.
 */
export function replay(actions: Action[]): ReplayResult {
  let state = emptyState();
  let last = -Infinity;
  for (const a of actions) {
    if (a.at < last) throw new Error(`actions must be in time order: ${a.at} after ${last}`);
    last = a.at;
    state = applyAction(state, a);
  }
  const finalElapsedMs = actions.length > 0 ? elapsedMs(state, actions[actions.length - 1]!.at) : 0;
  return { state, finalElapsedMs, laps: state.laps };
}
