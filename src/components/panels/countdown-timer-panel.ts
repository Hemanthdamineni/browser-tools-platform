/**
 * Countdown timer panel.
 *
 * Loaded on demand by `countdown-timer.astro`, so no timer code ships to pages
 * that are not running one.
 *
 * Everything worth testing lives here as pure functions: parsing `90s` /
 * `2m30s` input, the deadline maths (every timer stores an absolute end
 * timestamp and the remaining time is derived from the clock, so a tab that is
 * throttled, backgrounded or asleep still finishes at the right moment),
 * pausing and resuming, formatting, and sorting finished timers. Only the DOM
 * wiring and the Web Audio beep touch the browser.
 *
 * Nothing here ever leaves the device: the timers live in this tab, the beep is
 * synthesised on the fly, and a notification (only if the user opts in) is
 * raised by the browser itself.
 */
import type { TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from '../workbench/shared';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One countdown. It is driven from an absolute deadline so a sleeping tab still
 * finishes at the right wall-clock moment.
 */
export interface Timer {
  /** Stable id used to track this timer in the DOM. */
  id: string;
  /** What the timer is counting down. */
  label: string;
  /** The full duration, in milliseconds. */
  durationMs: number;
  /**
   * The absolute epoch-ms deadline while running; 0 while paused. Kept after
   * the timer finishes, because it is what orders the finished timers.
   */
  endAt: number;
  /** Remaining time in ms while paused; 0 while running or finished. */
  pausedRemainingMs: number;
  /** True while the countdown is ticking. */
  running: boolean;
  /** True once the countdown has reached zero and its alert has been raised. */
  fired: boolean;
}

/** A long enough wait to be useful, and short enough to be a mistake when wrong. */
export const MAX_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Parsing `90s`, `2m30s`, `1h05m`, `5:00`, `300`                             */
/* -------------------------------------------------------------------------- */

/** `1h`, `2 hours`, `3m`, `30 min`, `90s`, `45 seconds` — in that order. */
const DURATION_RE =
  /^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:onds?)?)?)?$/i;

/**
 * Parse a human duration such as `90s`, `2m30s`, `1h5m`, `5:00` or a bare
 * number of seconds, and return it in milliseconds.
 */
export function parseDuration(input: string): number {
  const raw = (input ?? '').trim();
  if (!raw) throw new ToolError('Enter a duration.', 'Try something like 90s, 2m30s or 1h.');

  const seconds = durationSeconds(raw);
  if (!Number.isFinite(seconds)) {
    throw new ToolError('That is not a valid duration.', 'Use forms like 90s, 2m30s, 1h or 5:00.');
  }
  if (seconds <= 0) {
    throw new ToolError('The duration must be more than zero.', 'Use something like 30s.');
  }
  const ms = Math.round(seconds * 1000);
  if (ms > MAX_MS) {
    throw new ToolError('That duration is too long.', 'The maximum is 24 hours.');
  }
  return ms;
}

/**
 * Turn `Tea 3m` into a named timer, `3m` into an unnamed one. The whole string
 * is tried as a duration first, so `1h 30m` stays ninety minutes rather than
 * being read as a timer called “1h”.
 */
export function parseTimerEntry(
  input: string,
  fallbackLabel: string,
): { label: string; durationMs: number } {
  const raw = (input ?? '').trim();
  if (!raw) throw new ToolError('Enter a duration.', 'Try something like 90s, 2m30s or Tea 3m.');

  if (Number.isFinite(durationSeconds(raw))) {
    return { label: fallbackLabel, durationMs: parseDuration(raw) };
  }

  // `Tea 3m` / `Boil the eggs 6m` — a name followed by a duration.
  const split = raw.lastIndexOf(' ');
  if (split > 0) {
    const name = raw.slice(0, split).replace(/:$/, '').trim();
    const rest = raw.slice(split + 1).trim();
    if (name && Number.isFinite(durationSeconds(rest))) {
      return { label: name, durationMs: parseDuration(rest) };
    }
  }

  // Nothing recognizable — let `parseDuration` raise the friendly error.
  return { label: fallbackLabel, durationMs: parseDuration(raw) };
}

/** Seconds, or NaN when the text is not a duration at all. */
function durationSeconds(raw: string): number {
  // A bare number of seconds: `90`, `300`.
  if (/^\d+$/.test(raw)) return Number(raw);

  // Colon form: `5:00` is mm:ss, `1:05:30` is hh:mm:ss.
  const colon = /^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/.exec(raw);
  if (colon) {
    const first = Number(colon[1]);
    const second = Number(colon[2]);
    const third = colon[3] ? Number(colon[3]) : null;
    if (third === null) {
      if (second > 59) return Number.NaN;
      return first * 60 + second;
    }
    if (second > 59 || third > 59) return Number.NaN;
    return first * 3600 + second * 60 + third;
  }

  // Compact letters: `90s`, `2m30s`, `1h5m30s`.
  const match = DURATION_RE.exec(raw);
  if (!match) return Number.NaN;
  const hours = match[1] ? Number(match[1]) : null;
  const minutes = match[2] ? Number(match[2]) : null;
  const seconds = match[3] ? Number(match[3]) : null;
  if (hours === null && minutes === null && seconds === null) return Number.NaN;
  // A smaller unit may only pass 59 when it stands on its own, so `90s` and
  // `90m` are fine while `2h90m` is a typo.
  if (minutes !== null && minutes > 59 && (hours !== null || seconds !== null)) {
    return Number.NaN;
  }
  if (seconds !== null && seconds > 59 && (hours !== null || minutes !== null)) {
    return Number.NaN;
  }
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Render a remaining time as a readable clock: `MM:SS`, or `H:MM:SS` from an
 * hour up. The value is rounded up so a running timer shows `00:01` until it
 * really reaches zero, and clamps at `00:00`.
 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Render a duration in words: `1 hour 5 minutes 30 seconds`, `90 seconds`. */
export function formatDurationWords(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total === 0) return '0 seconds';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/* -------------------------------------------------------------------------- */
/*  Deadline maths                                                            */
/* -------------------------------------------------------------------------- */

/** How long is left on a timer right now, in milliseconds (clamped at zero). */
export function remainingMs(timer: Timer, now: number): number {
  if (!timer.running) return Math.max(0, timer.pausedRemainingMs);
  return Math.max(0, timer.endAt - now);
}

/** A fresh timer, already running, with the given full duration. */
export function createTimer(id: string, label: string, durationMs: number, now: number): Timer {
  const clamped = Math.min(MAX_MS, Math.max(1, Math.round(durationMs)));
  return {
    id,
    label: (label ?? '').trim() || 'Timer',
    durationMs: clamped,
    endAt: now + clamped,
    pausedRemainingMs: 0,
    running: true,
    fired: false,
  };
}

/** Start a timer again from the top of its duration. */
export function startTimer(timer: Timer, now: number): Timer {
  return {
    ...timer,
    running: true,
    fired: false,
    endAt: now + timer.durationMs,
    pausedRemainingMs: 0,
  };
}

/**
 * Freeze a running timer: its remaining time is stored and the deadline is
 * ignored while paused, so no time leaks away.
 */
export function pauseTimer(timer: Timer, now: number): Timer {
  if (!timer.running) return timer;
  return {
    ...timer,
    running: false,
    endAt: timer.endAt,
    pausedRemainingMs: remainingMs(timer, now),
  };
}

/** Resume a paused timer by turning its frozen remaining time into a deadline. */
export function resumeTimer(timer: Timer, now: number): Timer {
  if (timer.running || timer.fired || timer.pausedRemainingMs <= 0) return timer;
  return { ...timer, running: true, endAt: now + timer.pausedRemainingMs, pausedRemainingMs: 0 };
}

/** True once a timer has reached zero. */
export function isExpired(timer: Timer, now: number): boolean {
  return !timer.fired && timer.running && remainingMs(timer, now) <= 0;
}

/**
 * Order timers for display and for the report: the finished ones first, most
 * recently expired first, then everything else in the order it was added.
 */
export function orderTimers<T extends { fired: boolean; endAt: number }>(timers: T[]): T[] {
  const finished = timers.filter((timer) => timer.fired).sort((a, b) => b.endAt - a.endAt);
  const pending = timers.filter((timer) => !timer.fired);
  return [...finished, ...pending];
}

/**
 * Mark every timer that has reached zero as finished, and move the finished
 * ones to the front of the list, most recently expired first. A tab that slept
 * through several deadlines settles them all in one pass.
 */
export function settleTimers(timers: Timer[], now: number): Timer[] {
  return orderTimers(timers.map((timer) => (isExpired(timer, now) ? expire(timer) : timer)));
}

/** The finished timers, most recently expired first. */
export function finishedTimers(timers: Timer[]): Timer[] {
  return timers.filter((timer) => timer.fired).sort((a, b) => b.endAt - a.endAt);
}

/** The timers that have just finished, i.e. fired in `after` but not in `before`. */
export function newlyFinished(before: Timer[], after: Timer[]): Timer[] {
  const already = new Set(before.filter((timer) => timer.fired).map((timer) => timer.id));
  return finishedTimers(after).filter((timer) => !already.has(timer.id));
}

/** Stop a timer at zero, keeping its deadline so the finish order survives. */
function expire(timer: Timer): Timer {
  return { ...timer, running: false, fired: true, pausedRemainingMs: 0 };
}

/* -------------------------------------------------------------------------- */
/*  Web Audio beep                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Play a short two-tone chime on the given AudioContext. It is synthesised on
 * the fly so the panel needs no audio asset file.
 */
export function beep(context: AudioContext): void {
  const start = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
  gain.gain.setValueAtTime(0.28, start + 0.42);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.54);
  gain.connect(context.destination);

  const tone = (at: number, frequency: number, stop: number): void => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.connect(gain);
    oscillator.start(at);
    oscillator.stop(stop);
  };

  tone(start, 880, start + 0.5);
  tone(start + 0.18, 660, start + 0.5);
}

/* -------------------------------------------------------------------------- */
/*  Report — the text snapshot the tool's `run()` consumes                     */
/* -------------------------------------------------------------------------- */

/** Serialise the live timers so the pure `run()` can build the report table. */
export function snapshotTimers(timers: Timer[], now: number): string {
  return JSON.stringify({
    now,
    timers: timers.map((timer) => ({
      ...timer,
      remainingMs: remainingMs(timer, now),
    })),
  });
}

/** The text payload the tool understands. */
export interface TimerSnapshot {
  now: number;
  timers: {
    id: string;
    label: string;
    durationMs: number;
    /** The absolute deadline (also the moment a finished timer expired). */
    endAt: number;
    remainingMs: number;
    running: boolean;
    fired: boolean;
  }[];
}

/** Parse a snapshot string back into its shape. */
export function parseSnapshot(text: string): TimerSnapshot {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError(
      'There are no timers to report yet.',
      'Add a timer and start it — the report fills in as it runs.',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError('The timer snapshot could not be read.', 'Reload the page and try again.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError(
      'The timer snapshot is not in the expected shape.',
      'Reload the page and try again.',
    );
  }
  const snapshot = parsed as Partial<TimerSnapshot>;
  if (typeof snapshot.now !== 'number' || !Array.isArray(snapshot.timers)) {
    throw new ToolError(
      'The timer snapshot is not in the expected shape.',
      'Reload the page and try again.',
    );
  }
  for (const timer of snapshot.timers) {
    if (!timer || typeof timer !== 'object') {
      throw new ToolError(
        'A timer in the snapshot is malformed.',
        'Reload the page and try again.',
      );
    }
  }
  return { now: snapshot.now, timers: snapshot.timers as TimerSnapshot['timers'] };
}

/** One report row: label, set duration, remaining, state. */
export function formatTimerRow(timer: TimerSnapshot['timers'][number]): string[] {
  const state = timer.fired
    ? 'Finished'
    : timer.running
      ? 'Running'
      : timer.remainingMs > 0
        ? 'Paused'
        : 'Waiting';
  return [
    timer.label,
    formatRemaining(timer.durationMs),
    formatRemaining(timer.remainingMs),
    state,
  ];
}

/* -------------------------------------------------------------------------- */
/*  DOM wiring                                                                */
/* -------------------------------------------------------------------------- */

/** Id sequence for timers created by the panel. */
let nextTimerId = 1;

/** The AudioContext constructor, including the old WebKit prefix. */
function audioContextConstructor(): typeof AudioContext | undefined {
  const win = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext;
}

/** Mount the countdown panel into a `[data-countdown-panel]` element. */
export function mountCountdownTimerPanel(panel: HTMLElement): void {
  const toolId = panel.dataset.toolId || 'countdown-timer';

  const listEl = panel.querySelector<HTMLElement>('[data-timer-list]')!;
  const durationInput = panel.querySelector<HTMLInputElement>('[data-duration-input]')!;
  const addBtn = panel.querySelector<HTMLButtonElement>('[data-add-timer]')!;
  const presetRow = panel.querySelector<HTMLElement>('[data-preset-row]')!;
  const exampleRow = panel.querySelector<HTMLElement>('[data-example-row]')!;
  const status = panel.querySelector<HTMLElement>('[data-timer-status]')!;
  const emptyEl = panel.querySelector<HTMLElement>('[data-timer-empty]')!;
  const summaryWrap = panel.querySelector<HTMLElement>('[data-timer-summary-wrap]')!;
  const summaryHost = panel.querySelector<HTMLElement>('[data-timer-summary]')!;
  const notesHost = panel.querySelector<HTMLUListElement>('[data-timer-notes]')!;
  const soundInput = panel.querySelector<HTMLInputElement>('[data-sound]')!;
  const notifyInput = panel.querySelector<HTMLInputElement>('[data-notify]')!;
  const formatSelect = panel.querySelector<HTMLSelectElement>('[data-format]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-timer-error]')!;

  if (
    !listEl ||
    !durationInput ||
    !addBtn ||
    !presetRow ||
    !status ||
    !emptyEl ||
    !summaryWrap ||
    !summaryHost ||
    !notesHost ||
    !soundInput ||
    !notifyInput ||
    !formatSelect ||
    !errorBox
  ) {
    return;
  }

  let timers: Timer[] = [];
  let tickHandle: number | null = null;
  let audioCtx: AudioContext | null = null;
  let reportGeneration = 0;

  /* ------------------------------------------------------------------------ */
  /*  Rendering                                                               */
  /* ------------------------------------------------------------------------ */

  function refresh(): void {
    renderList();
    void refreshReport();
  }

  function renderList(): void {
    const now = Date.now();
    listEl.innerHTML = '';
    for (const timer of timers) {
      const row = document.createElement('li');
      row.className = 'flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2.5';
      if (timer.fired) row.style.borderColor = 'rgb(var(--accent))';

      const label = document.createElement('span');
      label.className = 'min-w-0 flex-1 truncate text-sm font-medium text-[rgb(var(--text))]';
      label.textContent = timer.label;
      row.append(label);

      const readout = document.createElement('span');
      readout.className = 'font-mono text-lg tabular-nums text-[rgb(var(--text))]';
      readout.dataset.timerRemaining = timer.id;
      readout.textContent = formatRemaining(remainingMs(timer, now));
      row.append(readout);

      const actions = document.createElement('span');
      actions.className = 'flex items-center gap-1.5';

      if (!timer.fired) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn btn-subtle btn-sm';
        toggle.textContent = timer.running ? 'Pause' : 'Resume';
        toggle.addEventListener('click', () => {
          timers = timers.map((t) =>
            t.id === timer.id
              ? timer.running
                ? pauseTimer(t, Date.now())
                : resumeTimer(t, Date.now())
              : t,
          );
          announce(timer.running ? 'Timer paused.' : 'Timer resumed.');
          refresh();
          // A resumed timer must start ticking again; a paused one is a no-op.
          startTicking();
        });
        actions.append(toggle);
      }

      const restart = document.createElement('button');
      restart.type = 'button';
      restart.className = 'btn btn-ghost btn-sm';
      restart.textContent = 'Restart';
      restart.addEventListener('click', () => {
        timers = timers.map((t) => (t.id === timer.id ? startTimer(t, Date.now()) : t));
        announce('Timer restarted.');
        refresh();
        startTicking();
      });
      actions.append(restart);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-ghost btn-sm';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${timer.label}`);
      remove.addEventListener('click', () => {
        timers = timers.filter((t) => t.id !== timer.id);
        announce('Timer removed.');
        refresh();
      });
      actions.append(remove);

      row.append(actions);
      listEl.append(row);
    }
  }

  /**
   * Reconcile the timers against the clock: settle whatever has expired, raise
   * the alerts for the timers that just finished, repaint and refresh the
   * report. Used by both the tick loop and by the wake-up on focus.
   */
  function sync(): void {
    const before = timers;
    timers = settleTimers(timers, Date.now());
    const fired = newlyFinished(before, timers);
    if (fired.length) {
      // A finished timer loses its Pause button, so repaint its row.
      renderList();
      raiseAlert(fired);
    }
    updateReadouts();
    void refreshReport();
  }

  function tick(): void {
    sync();
    if (timers.some((timer) => timer.running)) {
      tickHandle = window.setTimeout(tick, 250);
    } else {
      stopTicking();
    }
  }

  function updateReadouts(): void {
    const now = Date.now();
    for (const timer of timers) {
      const cell = listEl.querySelector<HTMLElement>(`[data-timer-remaining="${timer.id}"]`);
      if (cell) cell.textContent = formatRemaining(remainingMs(timer, now));
    }
  }

  function startTicking(): void {
    if (tickHandle !== null) return;
    tickHandle = window.setTimeout(tick, 250);
  }

  function stopTicking(): void {
    if (tickHandle !== null) {
      window.clearTimeout(tickHandle);
      tickHandle = null;
    }
  }

  function announce(message: string): void {
    status.textContent = message;
  }

  function raiseAlert(fired: Timer[]): void {
    if (!fired.length) return;
    announce(
      fired.length === 1
        ? `“${fired[0]!.label}” finished.`
        : `${fired.length} timers finished: ${fired.map((timer) => timer.label).join(', ')}.`,
    );
    if (soundInput.checked) playBeep();
    if (notifyInput.checked) {
      for (const timer of fired) sendNotification(timer.label);
    }
  }

  function playBeep(): void {
    const AudioContextCtor = audioContextConstructor();
    if (!AudioContextCtor) return;
    try {
      if (!audioCtx) audioCtx = new AudioContextCtor();
      void audioCtx
        .resume()
        .then(() => beep(audioCtx!))
        .catch(() => undefined);
    } catch {
      // The beep is a nicety — never fail the panel because audio is blocked.
    }
  }

  function sendNotification(label: string): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(`${label} finished`, { body: 'Your countdown timer has run out.' });
    } catch {
      // Some browsers throw when a notification is created outside a gesture.
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  The tool report — the pure `run()` turns the snapshot into a table      */
  /* ------------------------------------------------------------------------ */

  function reportOptions(): Record<string, string | number | boolean> {
    return {
      format: formatSelect.value || 'clock',
      sound: soundInput.checked,
      notify: notifyInput.checked,
    };
  }

  function showEmpty(): void {
    emptyEl.hidden = false;
    summaryWrap.hidden = true;
  }

  async function refreshReport(): Promise<void> {
    if (!timers.length) {
      showEmpty();
      return;
    }
    emptyEl.hidden = true;
    summaryWrap.hidden = false;
    const generation = ++reportGeneration;
    try {
      const result = await runToolById<TextRunResult>(toolId, {
        text: snapshotTimers(timers, Date.now()),
        options: reportOptions(),
      });
      if (generation !== reportGeneration) return;
      renderReport(result);
    } catch {
      if (generation !== reportGeneration) return;
      summaryHost.innerHTML = '';
      notesHost.innerHTML = '';
    }
  }

  function renderReport(result: TextRunResult): void {
    summaryHost.innerHTML = '';
    let rows: string[][] = [];
    try {
      const table = JSON.parse(result.output) as { headers: string[]; rows: string[][] };
      rows = Array.isArray(table.rows) ? table.rows : [];
    } catch {
      rows = [];
    }
    const tableEl = document.createElement('table');
    tableEl.className = 'w-full text-left text-sm';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const header of ['Timer', 'Set', 'Remaining', 'State']) {
      const th = document.createElement('th');
      th.className =
        'border-b bg-[rgb(var(--bg-subtle))] px-3 py-2 text-left font-semibold text-[rgb(var(--text))]';
      th.textContent = header;
      headRow.append(th);
    }
    thead.append(headRow);
    tableEl.append(thead);
    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.className = 'border-b px-3 py-1.5 align-top font-mono text-xs text-[rgb(var(--text))]';
        td.textContent = cell;
        tr.append(td);
      }
      tbody.append(tr);
    }
    tableEl.append(tbody);
    summaryHost.append(tableEl);

    notesHost.innerHTML = '';
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-xs text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesHost.append(li);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  Adding timers                                                           */
  /* ------------------------------------------------------------------------ */

  function addTimer(entry: string, fallbackLabel: string): void {
    clearError(errorBox);
    let parsed: { label: string; durationMs: number };
    try {
      parsed = parseTimerEntry(entry, fallbackLabel);
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(errorBox, err.message, err.hint);
      return;
    }
    const timer = createTimer(
      `timer-${nextTimerId++}`,
      parsed.label,
      parsed.durationMs,
      Date.now(),
    );
    timers.push(timer);
    refresh();
    startTicking();
    unlockAudio();
  }

  addBtn.addEventListener('click', () => {
    const value = durationInput.value.trim();
    if (!value) return;
    addTimer(value, `Timer ${nextTimerId}`);
    durationInput.value = '';
    durationInput.focus();
  });

  durationInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const value = durationInput.value.trim();
    if (!value) return;
    addTimer(value, `Timer ${nextTimerId}`);
    durationInput.value = '';
  });

  presetRow.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((preset) => {
    preset.addEventListener('click', () => {
      const seconds = Number(preset.dataset.preset);
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      addTimer(String(seconds), `Timer ${nextTimerId}`);
    });
  });

  // One-click examples, when the tool declares any.
  exampleRow?.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((example) => {
    example.addEventListener('click', () => {
      const entry = example.dataset.exampleEntry ?? '';
      if (!entry) return;
      addTimer(entry, `Timer ${nextTimerId}`);
    });
  });

  // The AudioContext is created (and unlocked) on the first user action, so a
  // timer that finishes later is allowed to make a sound.
  function unlockAudio(): void {
    const AudioContextCtor = audioContextConstructor();
    if (!AudioContextCtor || audioCtx) return;
    try {
      audioCtx = new AudioContextCtor();
      void audioCtx.resume().catch(() => undefined);
    } catch {
      audioCtx = null;
    }
  }

  // Permission is only ever asked for on this direct user action.
  notifyInput.addEventListener('change', () => {
    if (!notifyInput.checked) return;
    if (typeof Notification === 'undefined') {
      notifyInput.checked = false;
      announce('This browser does not support desktop notifications.');
      return;
    }
    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((permission) => {
        if (permission !== 'granted') notifyInput.checked = false;
      });
    } else if (Notification.permission !== 'granted') {
      notifyInput.checked = false;
    }
  });

  // A backgrounded tab is throttled; when it wakes, settle against the clock
  // straight away instead of waiting for the next tick.
  window.addEventListener('focus', sync);

  window.addEventListener('beforeunload', () => stopTicking(), { once: true });

  announce('Add a duration to start a countdown.');
}
