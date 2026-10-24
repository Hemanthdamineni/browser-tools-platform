/**
 * The stopwatch panel and its timestamp maths.
 *
 * Time is computed from wall-clock timestamps rather than by counting ticks,
 * so the elapsed time stays correct when the tab sleeps or the browser
 * throttles `requestAnimationFrame`. Each state holds the moment a run began
 * (`performance.now()`) plus the milliseconds already banked from completed
 * runs; the current total is always `banked + (now - start)`.
 *
 * Everything worth testing lives in the pure functions below the module
 * header; the DOM wiring (`mountStopwatchPanel`) is the only browser code.
 */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { clearError, readOptions, renderTextResult, showError } from '../workbench/shared';
import { copyText } from '@/lib/clipboard';

/* -------------------------------------------------------------------------- */
/*  Pure timestamp maths                                                       */
/* -------------------------------------------------------------------------- */

/** One recorded lap: how far along the run it happened, and its own split. */
export interface LapRecord {
  /** Milliseconds from the start of the run (cumulative). */
  atMs: number;
  /** Milliseconds since the previous lap (the first lap's split = its `atMs`). */
  splitMs: number;
}

/** The whole stopwatch state, as the panel keeps it. */
export interface StopwatchSnapshot {
  /** Whether a run is in progress right now. */
  running: boolean;
  /** `performance.now()` when the current run began; 0 when stopped. */
  start: number;
  /** Milliseconds banked from runs that already finished. */
  accumulated: number;
  /** The recorded laps, oldest first. */
  laps: LapRecord[];
  /** The wall-clock instant the snapshot was taken (`performance.now()`). */
  now: number;
}

/** A stopwatch that has never been started. */
export function emptySnapshot(): StopwatchSnapshot {
  return { running: false, start: 0, accumulated: 0, laps: [], now: 0 };
}

/**
 * Total elapsed milliseconds at the snapshot's instant. Because it is derived
 * from timestamps, a large jump in `now` (the tab slept, the frame throttled)
 * is included exactly — the watch never drifts no matter how irregular the
 * ticks are.
 */
export function elapsedMs(snapshot: StopwatchSnapshot): number {
  if (!snapshot.running || snapshot.start <= 0) return Math.max(0, snapshot.accumulated);
  return Math.max(0, snapshot.accumulated + (snapshot.now - snapshot.start));
}

/** Pad a non-negative integer to at least `width` digits. */
function pad(value: number, width: number): string {
  return String(Math.floor(value)).padStart(width, '0');
}

/**
 * Format milliseconds as `HH:MM:SS.mmm`. Hours grow past two digits (a 100-hour
 * run reads `100:00:00.000`); minutes, seconds and the fraction are always
 * zero-padded.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

/** A lap with its display values and its fastest/slowest verdict. */
export interface LapRow {
  /** 1-based lap number. */
  index: number;
  /** This lap's split, formatted. */
  split: string;
  /** The run time when the lap was taken, formatted. */
  total: string;
  /** True when this lap ties for the fastest split. */
  fastest: boolean;
  /** True when this lap ties for the slowest split. */
  slowest: boolean;
}

/**
 * Turn the recorded laps into display rows, marking the fastest and slowest
 * splits. When several laps tie for a record, every one of them is marked.
 */
export function lapRows(snapshot: StopwatchSnapshot): LapRow[] {
  const rows = snapshot.laps.map((lap, i) => ({
    index: i + 1,
    split: formatElapsed(lap.splitMs),
    total: formatElapsed(lap.atMs),
    fastest: false,
    slowest: false,
  }));

  if (rows.length > 1) {
    const splits = snapshot.laps.map((lap) => lap.splitMs);
    const fastest = Math.min(...splits);
    const slowest = Math.max(...splits);
    rows.forEach((row, i) => {
      if (snapshot.laps[i]!.splitMs === fastest) row.fastest = true;
      if (snapshot.laps[i]!.splitMs === slowest) row.slowest = true;
    });
  }

  return rows;
}

/** The plain-text dump the "Copy all" button writes to the clipboard. */
export function copyAllText(snapshot: StopwatchSnapshot): string {
  const lines = [`Stopwatch — ${formatElapsed(elapsedMs(snapshot))}`];
  for (const row of lapRows(snapshot)) {
    lines.push(`Lap ${row.index}  split ${row.split}  total ${row.total}`);
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  The tool report                                                            */
/* -------------------------------------------------------------------------- */

/** Build the report the tool shows for a snapshot. */
export function buildReport(
  snapshot: StopwatchSnapshot,
  options: OptionValues,
): { output: string; stats: Record<string, string | number>; notes: string[] } {
  const includeSplits = options.includeSplits !== false;
  const rows = lapRows(snapshot);
  const headers = includeSplits ? ['Lap', 'Split', 'Total'] : ['Lap', 'Total'];

  const tableRows = rows.map((row) =>
    includeSplits
      ? [String(row.index), row.split, row.total]
      : [String(row.index), row.total],
  );

  if (snapshot.running) {
    tableRows.push(
      includeSplits
        ? ['—', 'running', formatElapsed(elapsedMs(snapshot))]
        : ['—', formatElapsed(elapsedMs(snapshot))],
    );
  }

  const stats: Record<string, string | number> = {
    elapsed: formatElapsed(elapsedMs(snapshot)),
    laps: snapshot.laps.length,
  };

  const notes: string[] = [];
  if (!snapshot.laps.length) {
    notes.push('No laps yet. Start the watch, then press Lap (or L) to mark one.');
  } else if (rows.length > 1) {
    notes.push('Fastest and slowest splits are highlighted.');
  }

  return {
    output: JSON.stringify({ headers, rows: tableRows }),
    stats,
    notes,
  };
}

/** Parse a snapshot payload; empty or malformed text falls back to a fresh watch. */
export function parseSnapshot(text: string): StopwatchSnapshot {
  const raw = (text ?? '').trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StopwatchSnapshot>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          running: parsed.running === true,
          start: Math.max(0, Number(parsed.start) || 0),
          accumulated: Math.max(0, Number(parsed.accumulated) || 0),
          laps: Array.isArray(parsed.laps)
            ? parsed.laps.map((lap) => ({
                atMs: Math.max(0, Number(lap?.atMs) || 0),
                splitMs: Math.max(0, Number(lap?.splitMs) || 0),
              }))
            : [],
          now: Math.max(0, Number(parsed.now) || 0),
        };
      }
    } catch {
      // Unreadable snapshot — fall back to a fresh watch.
    }
  }
  return emptySnapshot();
}

/** Run the stopwatch report over a JSON snapshot (empty text = a fresh watch). */
export function runStopwatch(text: string, options: OptionValues): TextRunResult {
  const snapshot = parseSnapshot(text);
  const report = buildReport(snapshot, options);
  return { ...report, render: 'table' };
}

/* -------------------------------------------------------------------------- */
/*  DOM wiring                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * True when the event came from something the user is already interacting
 * with — a field they are typing into, or a control that already handles Space
 * itself (so a focused button is not toggled twice).
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    tag === 'button' ||
    tag === 'a' ||
    el.isContentEditable
  );
}

/** Mount the stopwatch into a `[data-stopwatch-panel]` element. */
export function mountStopwatchPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'stopwatch';

  const readout = root.querySelector<HTMLElement>('[data-sw-readout]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-sw-start]')!;
  const lapBtn = root.querySelector<HTMLButtonElement>('[data-sw-lap]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-sw-reset]')!;
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-sw-copy]')!;
  const viewReportBtn = root.querySelector<HTMLButtonElement>('[data-sw-view]')!;
  const lapsHost = root.querySelector<HTMLElement>('[data-sw-laps]')!;
  const status = root.querySelector<HTMLElement>('[data-sw-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-sw-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-sw-result-wrap]')!;
  const reportHost = root.querySelector<HTMLElement>('[data-sw-report]')!;

  if (
    !readout ||
    !startBtn ||
    !lapBtn ||
    !resetBtn ||
    !copyBtn ||
    !lapsHost ||
    !status ||
    !errorBox ||
    !resultWrap ||
    !reportHost
  ) {
    return;
  }

  let snapshot: StopwatchSnapshot = emptySnapshot();
  let raf = 0;
  let reportTimer = 0;

  function setStatus(message: string): void {
    status.textContent = message;
  }

  function renderLaps(): void {
    const rows = lapRows(snapshot);
    lapsHost.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'text-xs text-[rgb(var(--text-muted))]';
      empty.textContent = 'No laps yet — press Lap while the watch runs.';
      lapsHost.append(empty);
      return;
    }
    for (const row of rows) {
      const li = document.createElement('li');
      let liClass = 'flex items-baseline gap-3 rounded-md border px-3 py-1.5 text-sm';
      if (row.fastest || row.slowest) {
        liClass +=
          ' border-[rgb(var(--accent))] bg-[rgb(var(--accent-soft))]';
      }
      if (row.slowest) {
        liClass += ' border-[rgb(var(--danger))] bg-[rgb(var(--danger-soft))]';
      }
      li.className = liClass;
      li.dataset.fastest = String(row.fastest);
      li.dataset.slowest = String(row.slowest);
      const num = document.createElement('span');
      num.className = 'font-mono tabular-nums text-[rgb(var(--text-muted))]';
      num.textContent = `Lap ${row.index}`;
      li.append(num);
      if (row.fastest || row.slowest) {
        const tag = document.createElement('span');
        const both = row.fastest && row.slowest;
        const label = both ? 'fastest · slowest' : row.fastest ? 'fastest' : 'slowest';
        tag.className = [
          'text-[0.65rem] font-semibold uppercase tracking-wide',
          both || row.fastest ? 'text-[rgb(var(--accent-strong))]' : 'text-[rgb(var(--danger))]',
        ].join(' ');
        tag.dataset.tag = both ? 'both' : row.fastest ? 'fastest' : 'slowest';
        tag.textContent = label;
        li.append(tag);
      }
      const val = document.createElement('span');
      val.className = 'ml-auto font-mono tabular-nums text-[rgb(var(--text))]';
      val.textContent = `${row.split} · ${row.total}`;
      li.append(val);
      lapsHost.append(li);
    }
  }

  function tick(now: number): void {
    snapshot.now = now;
    readout.textContent = formatElapsed(elapsedMs(snapshot));
    renderLaps();
  }

  function startLoop(): void {
    cancelAnimationFrame(raf);
    const loop = (now: number): void => {
      tick(now);
      raf = snapshot.running ? requestAnimationFrame(loop) : 0;
    };
    raf = requestAnimationFrame(loop);
  }

  function setRunning(running: boolean): void {
    const now = performance.now();
    if (running) {
      snapshot.start = now;
    } else {
      snapshot.accumulated += Math.max(0, now - snapshot.start);
      snapshot.start = 0;
    }
    snapshot.running = running;
    tick(now);
    startBtn.textContent = running ? 'Pause' : 'Start';
    lapBtn.disabled = !running;
    setStatus(running ? 'Running' : 'Paused');
  }

  function recordLap(): void {
    if (!snapshot.running) return;
    const now = performance.now();
    const atMs = snapshot.accumulated + (now - snapshot.start);
    const prev = snapshot.laps[snapshot.laps.length - 1]?.atMs ?? 0;
    snapshot.laps.push({ atMs, splitMs: atMs - prev });
    tick(now);
    setStatus(`Lap ${snapshot.laps.length} recorded.`);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.repeat || isInteractiveTarget(event.target)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      setRunning(!snapshot.running);
      if (snapshot.running) startLoop();
      scheduleReport();
    } else if (event.key === 'l' || event.key === 'L') {
      recordLap();
      if (snapshot.running) startLoop();
      scheduleReport();
    }
  }

  // The listener is re-registered on reset so a mounted panel always has
  // exactly one live keyboard handler, even across Reset clicks.
  function reset(): void {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', handleKeydown);
    snapshot = emptySnapshot();
    readout.textContent = formatElapsed(0);
    renderLaps();
    lapBtn.disabled = true;
    startBtn.textContent = 'Start';
    resultWrap.hidden = true;
    clearError(errorBox);
    setStatus('Ready.');
    document.addEventListener('keydown', handleKeydown);
  }

  async function refreshReport(): Promise<void> {
    try {
      const result = await runToolById<TextRunResult>(toolId, {
        text: JSON.stringify(snapshot),
        options: readOptions(root),
      });
      renderTextResult(reportHost, result);
      resultWrap.hidden = false;
      clearError(errorBox);
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'The report could not be built.', e.hint);
    }
  }

  function scheduleReport(): void {
    window.clearTimeout(reportTimer);
    reportTimer = window.setTimeout(() => {
      void refreshReport();
    }, 300);
  }

  startBtn.addEventListener('click', () => {
    setRunning(!snapshot.running);
    if (snapshot.running) startLoop();
    scheduleReport();
  });

  lapBtn.addEventListener('click', () => {
    recordLap();
    if (snapshot.running) startLoop();
    scheduleReport();
  });

  resetBtn.addEventListener('click', reset);

  copyBtn.addEventListener('click', () => {
    void copyText(copyAllText(snapshot)).then((ok) => {
      setStatus(ok ? 'Copied to clipboard.' : 'Could not copy to clipboard.');
    });
  });

  viewReportBtn?.addEventListener('click', () => {
    void refreshReport();
  });

  // Example chips fill the watch with a canned run, then rebuild the report.
  const examples = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-example]'));
  examples.forEach((btn) => {
    btn.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      const payload = JSON.parse(btn.dataset.examplePayload ?? '{}') as {
        input: string;
        options: OptionValues;
      };
      // Seed the live watch from the example snapshot so the readout matches.
      snapshot = parseSnapshot(payload.input);
      tick(performance.now());
      applyOptions(root, payload.options);
      void refreshReport();
    });
  });

  root.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-opt-key]')) {
      void refreshReport();
    }
  });

  reset();
}

/** Apply an example's options to the panel's form. */
function applyOptions(root: HTMLElement, values: OptionValues): void {
  root.querySelectorAll<HTMLInputElement>('[data-opt-key]').forEach((input) => {
    const key = input.dataset.optKey!;
    if (!(key in values)) return;
    if (input.type === 'checkbox') {
      input.checked = Boolean(values[key]);
    } else {
      input.value = String(values[key]);
    }
  });
}