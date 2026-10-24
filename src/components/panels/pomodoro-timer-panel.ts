/**
 * The Pomodoro timer panel.
 *
 * A Pomodoro timer cannot live in the generic text or file workbench — it is a
 * live, always-running UI. So the tool opts into this panel, which owns the
 * countdown, the notification opt-in and the `localStorage` persistence.
 *
 * The pure state machine lives in `pomodoro-timer.core.ts` and is unit-tested
 * directly; this module wires it to the DOM. Timing is deadline-based: the
 * panel stores the wall-clock deadline of the current phase and derives the
 * remaining time from `Date.now()` on every tick, so a throttled or hidden tab
 * catches up exactly when it wakes instead of drifting behind.
 *
 * Settings and the running session are persisted in `localStorage` only — the
 * timer never touches the network.
 */
import { runToolById } from '@/lib/worker/client';
import type { TextRunResult } from '@/lib/types';
import { clearError, readOptions, renderTextResult, showError } from '../workbench/shared';
import {
  SETTINGS_KEY,
  SESSION_KEY,
  applySettings,
  catchUp,
  formatClock,
  initialState,
  nextPhase,
  normalizeSettings,
  notificationFor,
  openPhase,
  parseSession,
  parseSettings,
  phaseDurationMs,
  phaseLabel,
  remainingFor,
  remainingMs,
  snapshotJson,
  type Phase,
  type PomodoroSettings,
  type TimerSnapshot,
} from '@/tools/datetime/pomodoro-timer.core';

/**
 * The panel's public surface: the pure timer API it is built on.
 *
 * The state machine lives in `pomodoro-timer.core.ts` so the tool can share it
 * without importing anything from `components/`; re-exporting it here keeps the
 * panel a single import for its own tests.
 */
export * from '@/tools/datetime/pomodoro-timer.core';

/* -------------------------------------------------------------------------- */
/*  DOM wiring                                                                 */
/* -------------------------------------------------------------------------- */

/** How often the on-screen clock is refreshed (ms). */
const TICK_MS = 250;

/** Read a value from `localStorage` without letting a blocked store throw. */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Write a value to `localStorage`, ignoring a blocked or full store. */
function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* a blocked or full localStorage is not fatal — the timer still runs */
  }
}

/** Mount the Pomodoro timer into a `[data-pomodoro-timer-panel]` element. */
export function mountPomodoroTimerPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'pomodoro-timer';
  const clock = root.querySelector<HTMLElement>('[data-clock]')!;
  const phaseEl = root.querySelector<HTMLElement>('[data-phase]')!;
  const sessionEl = root.querySelector<HTMLElement>('[data-sessions]')!;
  const cycleEl = root.querySelector<HTMLElement>('[data-cycle]')!;
  const progress = root.querySelector<HTMLElement>('[data-progress]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-pause]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const skipBtn = root.querySelector<HTMLButtonElement>('[data-skip]')!;
  const notifyInput = root.querySelector<HTMLInputElement>('[data-opt-key="notifyOnPhase"]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-report]')!;
  const statsEl = root.querySelector<HTMLElement>('[data-stats]')!;
  const notesEl = root.querySelector<HTMLElement>('[data-notes]')!;

  let settings = parseSettings(readStorage(SETTINGS_KEY));
  let session =
    parseSession(readStorage(SESSION_KEY)) ??
    openPhase(settings, initialState(), Date.now(), false);

  const settingsFromForm = (): PomodoroSettings => normalizeSettings(readOptions(root));

  /** Write the persisted settings back into the form the first time we mount. */
  function populateForm(): void {
    for (const input of root.querySelectorAll<HTMLElement>('[data-opt-key]')) {
      const key = input.dataset.optKey;
      if (!key || !(key in settings)) continue;
      const value = settings[key as keyof PomodoroSettings];
      if (typeof value === 'boolean') {
        (input as HTMLInputElement).checked = value;
      } else if (typeof value === 'number') {
        (input as HTMLInputElement).value = String(value);
      }
    }
  }

  function render(): void {
    const idle = session.state.phase === 'idle';
    const total = idle ? phaseDurationMs(settings, 'working') : phaseDurationMs(settings, session.state.phase);
    const remaining = idle ? total : remainingFor(session, Date.now());
    clock.textContent = formatClock(remaining);
    phaseEl.textContent = phaseLabel(session.state.phase);

    const done = total > 0 ? 1 - remaining / total : 0;
    progress.style.width = `${(Math.max(0, Math.min(1, done)) * 100).toFixed(1)}%`;

    sessionEl.textContent = String(session.state.completedSessions);
    cycleEl.textContent = `${session.state.completedWork} / ${settings.cyclesBeforeLongBreak}`;

    startBtn.disabled = session.running;
    pauseBtn.disabled = !session.running;
    pauseBtn.textContent = session.running ? 'Pause' : 'Resume';
    resetBtn.disabled = idle && !session.running;

    if (session.state.phase === 'idle') {
      statusEl.textContent = 'Ready — press Start to begin a work phase.';
    } else if (session.running) {
      statusEl.textContent =
        `${phaseLabel(session.state.phase)} in progress — deadline-based, ` +
        'so a throttled tab stays accurate.';
    } else {
      statusEl.textContent = `Paused during your ${phaseLabel(session.state.phase).toLowerCase()}.`;
    }
  }

  function persist(): void {
    writeStorage(SESSION_KEY, JSON.stringify(session));
  }

  function announce(previous: Phase, next: Phase): void {
    if (!settings.notifyOnPhase || typeof Notification === 'undefined') return;
    try {
      if (Notification.permission !== 'granted') return;
      const notice = notificationFor(previous, next);
      new Notification(notice.title, { body: notice.body, tag: 'pomodoro-timer' });
    } catch {
      /* a notification is a nicety — never let it break the timer */
    }
  }

  /** Hand the current snapshot to the tool and show the report it chooses. */
  async function refreshReport(): Promise<void> {
    const snapshot: TimerSnapshot = { ...session, settings };
    try {
      const result = await runToolById<TextRunResult>(toolId, {
        text: snapshotJson(snapshot),
        options: { ...settings },
      });
      renderTextResult(reportEl, result);
      reportEl.hidden = false;
      resultWrap.hidden = false;
      statsEl.replaceChildren();
      for (const [key, value] of Object.entries(result.stats ?? {})) {
        const span = document.createElement('span');
        const label = document.createElement('span');
        label.className = 'font-medium text-[rgb(var(--text))]';
        label.textContent = `${key}:`;
        span.append(label, ` ${value}`);
        statsEl.appendChild(span);
      }
      notesEl.replaceChildren();
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.textContent = note;
        notesEl.appendChild(li);
      }
      clearError(errorBox);
    } catch {
      showError(errorBox, 'The session summary could not be built.', 'Reload the page to retry.');
    }
  }

  /** Finish the current phase and open the next one, running or paused. */
  function advance(autoStart: boolean): void {
    const previous = session.state.phase;
    const state = nextPhase(settings, session.state);
    session = openPhase(settings, state, Date.now(), autoStart);
    announce(previous, state.phase);
    persist();
    render();
    void refreshReport();
  }

  function tick(): void {
    const now = Date.now();
    if (session.running && session.endAt != null && remainingMs(session.endAt, now) <= 0) {
      const autoStart =
        session.state.phase === 'working'
          ? settings.autoStartBreaks
          : settings.autoStartWork;
      advance(autoStart);
      return;
    }
    render();
  }

  function start(): void {
    if (session.running) return;
    clearError(errorBox);
    const previous = session.state.phase;
    if (session.state.phase === 'idle') {
      session = openPhase(settings, nextPhase(settings, session.state), Date.now(), true);
    } else {
      session = { ...session, endAt: Date.now() + remainingFor(session, Date.now()), running: true };
    }
    if (session.state.phase !== previous) announce(previous, session.state.phase);
    persist();
    render();
    void refreshReport();
  }

  function pause(): void {
    if (!session.running) return;
    session = {
      ...session,
      remaining: remainingFor(session, Date.now()),
      endAt: null,
      running: false,
    };
    persist();
    render();
  }

  function reset(): void {
    session = openPhase(settings, initialState(), Date.now(), false);
    persist();
    render();
    resultWrap.hidden = true;
  }

  function skip(): void {
    advance(session.state.phase === 'idle' ? true : session.running);
  }

  notifyInput.addEventListener('change', () => {
    if (!notifyInput.checked) return;
    if (typeof Notification === 'undefined') {
      notifyInput.checked = false;
      settings = { ...settingsFromForm(), notifyOnPhase: false };
      writeStorage(SETTINGS_KEY, JSON.stringify(settings));
      showError(
        errorBox,
        'This browser does not support notifications.',
        'The timer still runs without them.',
      );
      return;
    }
    if (Notification.permission === 'granted') return;
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') return;
      notifyInput.checked = false;
      settings = { ...settingsFromForm(), notifyOnPhase: false };
      writeStorage(SETTINGS_KEY, JSON.stringify(settings));
      showError(
        errorBox,
        'Notifications were not allowed.',
        'You can allow them later in the browser’s site settings.',
      );
    });
  });

  for (const input of root.querySelectorAll<HTMLElement>('[data-opt-key]')) {
    input.addEventListener('change', () => {
      settings = settingsFromForm();
      session = applySettings(session, settings);
      writeStorage(SETTINGS_KEY, JSON.stringify(settings));
      persist();
      render();
    });
  }

  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', pause);
  resetBtn.addEventListener('click', reset);
  skipBtn.addEventListener('click', skip);

  // A tab that was closed mid-phase comes back to the next phase, paused.
  const restored = catchUp(session, settings, Date.now());
  if (restored.changed) {
    session = { ...restored.session, running: false, endAt: null };
    persist();
    const next = session.state.phase;
    announce(next === 'working' ? 'shortBreak' : 'working', next);
  }

  render();
  populateForm();
  window.setInterval(tick, TICK_MS);
}
