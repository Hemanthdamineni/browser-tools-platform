/**
 * Typing test panel.
 *
 * Loaded on demand by `typing-test.astro` so no typing-test code ships to
 * pages that do not use it. The module owns the browser APIs the tool needs —
 * the hidden focus input, the countdown/stopwatch and the per-character
 * highlight rendering — and records every keystroke so the metrics can be
 * computed deterministically from the raw records.
 *
 * The pure, testable logic (the seeded word sampler, the metric maths and the
 * local history helpers) lives in `src/tools/text/typing-test.core.ts` and is
 * re-exported here so this panel's tests can import it without a DOM.
 *
 * When a run finishes the panel hands the recorded session to the tool's own
 * `run()` (through `runToolById`) and renders the report it returns. History
 * is stored in `localStorage` only. Nothing leaves the device.
 */
import type { TextRunResult } from '@/lib/types';
import { renderTextResult } from '../workbench/shared';
import {
  appendHistory,
  buildTarget,
  clearHistory,
  computeMetrics,
  readHistory,
  sampleWords,
  DEFAULT_TIME_MS,
  HISTORY_KEY,
  HISTORY_CAP,
  CONSISTENCY_WINDOW_MS,
  TIME_MODE_WORDS,
  type HistoryEntry,
  type KeystrokeRecord,
  type TypingMetrics,
  type TypingSession,
} from '@/tools/text/typing-test.core';

// Re-export the pure logic so the panel's unit tests import from one place.
export {
  appendHistory,
  buildTarget,
  clearHistory,
  computeMetrics,
  mulberry32,
  readHistory,
  sampleWords,
  DEFAULT_TIME_MS,
  HISTORY_KEY,
  HISTORY_CAP,
  CONSISTENCY_WINDOW_MS,
  TIME_MODE_WORDS,
} from '@/tools/text/typing-test.core';
export type {
  HistoryEntry,
  KeystrokeRecord,
  TypingMetrics,
  TypingSession,
} from '@/tools/text/typing-test.core';

/** Mount the typing test into a `[data-typing-panel]` element. */
export function mountTypingTestPanel(panel: HTMLElement): void {
  const errorBox = panel.querySelector<HTMLElement>('[data-tp-error]')!;
  const modeSel = panel.querySelector<HTMLSelectElement>('[data-tp-mode]')!;
  const timeSel = panel.querySelector<HTMLSelectElement>('[data-tp-time]')!;
  const wordsInput = panel.querySelector<HTMLInputElement>('[data-tp-words]')!;
  const timeWrap = panel.querySelector<HTMLElement>('[data-tp-time-wrap]')!;
  const wordsWrap = panel.querySelector<HTMLElement>('[data-tp-words-wrap]')!;
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-tp-start]')!;
  const restartBtn = panel.querySelector<HTMLButtonElement>('[data-tp-restart]')!;
  const statusEl = panel.querySelector<HTMLElement>('[data-tp-status]')!;
  const timerEl = panel.querySelector<HTMLElement>('[data-tp-timer]')!;
  const targetEl = panel.querySelector<HTMLElement>('[data-tp-target]')!;
  const input = panel.querySelector<HTMLInputElement>('[data-tp-input]')!;
  const liveWpm = panel.querySelector<HTMLElement>('[data-tp-live-wpm]')!;
  const liveAcc = panel.querySelector<HTMLElement>('[data-tp-live-acc]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-tp-result]')!;
  const reportHost = panel.querySelector<HTMLElement>('[data-tp-report]')!;
  const historyEl = panel.querySelector<HTMLElement>('[data-tp-history]')!;
  const clearHistoryBtn = panel.querySelector<HTMLButtonElement>('[data-tp-clear-history]')!;
  const announceEl = panel.querySelector<HTMLElement>('[data-tp-live]')!;

  if (
    !errorBox ||
    !modeSel ||
    !timeSel ||
    !wordsInput ||
    !timeWrap ||
    !wordsWrap ||
    !startBtn ||
    !restartBtn ||
    !statusEl ||
    !timerEl ||
    !targetEl ||
    !input ||
    !liveWpm ||
    !liveAcc ||
    !resultWrap ||
    !reportHost ||
    !historyEl ||
    !clearHistoryBtn ||
    !announceEl
  ) {
    return;
  }

  /** The word list the user is currently typing. */
  let target = '';
  /** The per-character <span> for the target, one per code point. */
  let charSpans: HTMLSpanElement[] = [];
  /** Every printable keystroke of the current run, oldest first. */
  let records: KeystrokeRecord[] = [];
  /** The run mode: 'time' or 'words'. */
  let mode: 'time' | 'words' = 'time';
  /** How long a time run lasts, in milliseconds. */
  let configuredDurationMs = DEFAULT_TIME_MS;
  /** Index into `target` where the caret currently sits. */
  let caret = 0;
  /** True while the most recent keystroke at the caret was a mistake. */
  let pendingError = false;
  /** True while the test is accepting keystrokes. */
  let running = false;
  /** True once the test has finished (and before the next start). */
  let finished = false;
  /** When the run began (performance clock). */
  let startedAt = 0;
  /** The interval that advances the time-mode countdown. */
  let timerHandle: number | null = null;

  /* ------------------------------------------------------------------ */
  /*  Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  function announce(message: string): void {
    statusEl.textContent = message;
    announceEl.textContent = message;
  }

  function clearError(): void {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function elapsedMs(): number {
    return Math.max(0, Math.round(performance.now() - startedAt));
  }

  /** The current net WPM and accuracy, live. */
  function liveMetrics(): { wpm: number; acc: number } {
    const ms = elapsedMs();
    const metrics = computeMetrics(records, ms > 0 ? ms : 1);
    return { wpm: metrics.netWpm, acc: metrics.accuracy };
  }

  function renderTarget(): void {
    targetEl.replaceChildren();
    charSpans = [];
    for (const ch of Array.from(target)) {
      const span = document.createElement('span');
      span.dataset.tpChar = '';
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      targetEl.appendChild(span);
      charSpans.push(span);
    }
  }

  /** Append more words in time mode, so the target never runs out mid-test. */
  function extendTarget(): void {
    target = `${target} ${sampleWords(seedForRun(), 20).join(' ')}`;
    renderTarget();
  }

  function paint(): void {
    for (let i = 0; i < charSpans.length; i += 1) {
      const span = charSpans[i]!;
      if (i < caret) {
        span.dataset.state = 'correct';
      } else if (i === caret) {
        span.dataset.state = pendingError ? 'wrong' : 'current';
      } else {
        span.dataset.state = 'pending';
      }
    }
  }

  function updateLive(): void {
    const { wpm, acc } = liveMetrics();
    liveWpm.textContent = formatWpm(wpm);
    liveAcc.textContent = formatPercent(acc);
  }

  function updateTimer(): void {
    if (mode !== 'time') return;
    const remaining = Math.max(0, configuredDurationMs - elapsedMs());
    timerEl.textContent = formatTimer(remaining);
    if (remaining <= 0) {
      finish();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  The run                                                            */
  /* ------------------------------------------------------------------ */

  function currentMode(): 'time' | 'words' {
    return modeSel.value === 'words' ? 'words' : 'time';
  }

  function applyMode(): void {
    mode = currentMode();
    timeWrap.hidden = mode !== 'time';
    wordsWrap.hidden = mode !== 'words';
  }

  function wordCount(): number {
    const n = Math.round(Number(wordsInput.value));
    if (!Number.isFinite(n)) return 30;
    return Math.max(10, Math.min(200, n));
  }

  function seedForRun(): number {
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  function start(): void {
    clearError();
    mode = currentMode();
    applyMode();
    configuredDurationMs =
      mode === 'time' ? Math.round(Number(timeSel.value) * 1000) : 0;

    const count = mode === 'time' ? TIME_MODE_WORDS : wordCount();
    target = buildTarget(seedForRun(), count);
    caret = 0;
    pendingError = false;
    records = [];
    finished = false;
    running = true;

    resultWrap.hidden = true;
    renderTarget();
    paint();
    updateLive();
    timerEl.textContent = mode === 'time' ? formatTimer(configuredDurationMs) : '—';
    startBtn.hidden = true;
    restartBtn.hidden = false;
    input.value = '';
    startedAt = performance.now();
    input.focus();
    announce(
      mode === 'time'
        ? `Type for ${configuredDurationMs / 1000} seconds. Start typing.`
        : `Type the ${count} words. Start typing.`,
    );

    if (mode === 'time') {
      timerHandle = window.setInterval(updateTimer, 100);
    }
  }

  function restart(): void {
    if (timerHandle !== null) {
      window.clearInterval(timerHandle);
      timerHandle = null;
    }
    running = false;
    finished = false;
    start();
  }

  function finish(): void {
    running = false;
    finished = true;
    if (timerHandle !== null) {
      window.clearInterval(timerHandle);
      timerHandle = null;
    }
    const durationMs =
      mode === 'time'
        ? configuredDurationMs
        : Math.max(1, Math.round(performance.now() - startedAt));
    const metrics = computeMetrics(records, durationMs);
    saveResult(metrics, durationMs);
    announce(
      `Test finished — ${Math.round(metrics.netWpm)} WPM, ${metrics.accuracy.toFixed(1)}% accuracy.`,
    );
    void publishReport(durationMs);
    input.blur();
  }

  /**
   * Hand the finished session to the tool's own `run()` and render its report.
   * The worker client keeps this module's DOM work off the main thread path
   * that the pure logic shares.
   */
  async function publishReport(durationMs: number): Promise<void> {
    const session: TypingSession = {
      records,
      target,
      mode,
      durationMs,
      words: target.split(/\s+/).filter(Boolean).length,
    };
    try {
      const result = await runToolById<TextRunResult>('typing-test', {
        text: JSON.stringify(session),
        options: { mode, duration: String(configuredDurationMs / 1000), words: wordCount() },
      });
      renderTextResult(reportHost, result);
      resultWrap.hidden = false;
      clearError();
    } catch (error) {
      const e = error as Error & { hint?: string };
      errorBox.hidden = false;
      errorBox.textContent = e.message || 'The report could not be built.';
    }
  }

  function saveResult(metrics: TypingMetrics, durationMs: number): void {
    const entry: HistoryEntry = {
      id: `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      netWpm: Math.round(metrics.netWpm * 10) / 10,
      rawWpm: Math.round(metrics.rawWpm * 10) / 10,
      accuracy: Math.round(metrics.accuracy * 10) / 10,
      mode,
      words: target.split(/\s+/).filter(Boolean).length,
      durationMs,
      at: new Date().toISOString(),
    };
    appendHistory(localStorage, entry);
    renderHistory();
  }

  function renderHistory(): void {
    const entries = readHistory(localStorage);
    historyEl.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'text-xs text-[rgb(var(--text-muted))]';
      empty.textContent = 'No results yet — finish a run and it appears here.';
      historyEl.appendChild(empty);
      return;
    }
    // Newest first.
    for (const entry of [...entries].reverse()) {
      const li = document.createElement('li');
      li.className = 'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs';
      const score = document.createElement('span');
      score.className = 'font-mono tabular-nums font-medium text-[rgb(var(--text))]';
      score.textContent = `${formatWpm(entry.netWpm)} WPM`;
      const acc = document.createElement('span');
      acc.className = 'text-[rgb(var(--text-muted))]';
      acc.textContent = `${formatPercent(entry.accuracy)} acc`;
      const meta = document.createElement('span');
      meta.className = 'text-[rgb(var(--text-muted))]';
      const label =
        entry.mode === 'time' ? `${Math.round(entry.durationMs / 1000)}s` : `${entry.words} words`;
      meta.textContent = `${label} · ${new Date(entry.at).toLocaleTimeString()}`;
      li.append(score, acc, meta);
      historyEl.appendChild(li);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Keystrokes                                                         */
  /* ------------------------------------------------------------------ */

  function onKeyDown(event: KeyboardEvent): void {
    if (!running || finished) {
      if (event.key === 'Tab') {
        input.focus();
        event.preventDefault();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      // The no-backspace model: a wrong character stays at the caret until
      // the correct one is typed. Backspace simply re-paints the current
      // character so the reader can re-read what is still required.
      paint();
      return;
    }

    if (event.key.length !== 1) return;
    event.preventDefault();

    const expected = target[caret] ?? '';
    const typed = event.key;
    records.push({ expected, typed, at: elapsedMs() });

    if (typed === expected) {
      caret += 1;
      pendingError = false;
      if (caret >= target.length) {
        if (mode === 'time') {
          extendTarget();
        } else {
          finish();
          return;
        }
      } else if (mode === 'time' && caret + 40 >= target.length) {
        extendTarget();
      }
      updateLive();
    } else {
      pendingError = true;
    }
    paint();
  }

  /* ------------------------------------------------------------------ */
  /*  Wire up                                                             */
  /* ------------------------------------------------------------------ */

  function resetUI(): void {
    applyMode();
    target = '';
    records = [];
    caret = 0;
    pendingError = false;
    running = false;
    finished = false;
    resultWrap.hidden = true;
    startBtn.hidden = false;
    restartBtn.hidden = true;
    targetEl.replaceChildren();
    liveWpm.textContent = '—';
    liveAcc.textContent = '—';
    timerEl.textContent = mode === 'time' ? formatTimer(configuredDurationMs) : '—';
    input.value = '';
    announce('Press “Start” and type the words that appear.');
    renderHistory();
  }

  modeSel.addEventListener('change', () => {
    applyMode();
    if (!running) {
      timerEl.textContent =
        mode === 'time' ? formatTimer(Math.round(Number(timeSel.value) * 1000)) : '—';
    }
  });
  timeSel.addEventListener('change', () => {
    if (!running) timerEl.textContent = formatTimer(Math.round(Number(timeSel.value) * 1000));
  });
  startBtn.addEventListener('click', start);
  restartBtn.addEventListener('click', restart);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', () => {
    if (running && !finished) {
      // Return focus so the test keeps accepting keys.
      input.focus();
    }
  });
  clearHistoryBtn.addEventListener('click', () => {
    clearHistory(localStorage);
    renderHistory();
  });

  resetUI();
}

/** Format a WPM value as a whole number. */
function formatWpm(value: number): string {
  return `${Math.round(value)}`;
}

/** Format a percentage with one decimal place. */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format a millisecond duration as m:ss (or ss for under a minute). */
function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}