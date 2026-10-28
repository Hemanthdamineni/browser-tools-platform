/**
 * Keyboard tester panel.
 *
 * Loaded on demand by `keyboard-tester.astro` so no keyboard code ships to
 * pages that do not test a keyboard.
 *
 * The panel owns the browser APIs: it listens for `keydown`/`keyup`, lights up
 * the matching key on the on-screen layout, keeps the live readout and drives
 * the rollover test. The verdict on a rollover attempt is not decided here —
 * the panel hands what it collected to the tool's own `run()` (through
 * `runToolById`), which builds the report table.
 *
 * Everything here is local: the key events are read in the tab and used to
 * draw the screen. Nothing is recorded, stored or transmitted.
 */
import { runToolById } from '@/lib/worker/client';
import type { TextRunResult } from '@/lib/types';
import { clearError, renderTextResult, showError } from '../workbench/shared';
import {
  GHOSTING_CHALLENGES,
  codeToKey,
  describeEvent,
  evaluateGhosting,
  formatCombination,
  keyLabel,
  parseCombination,
  type KeyEventLike,
} from '@/tools/device/keyboard-tester.core';

/** How long the readout keeps a released key before it goes back to "—". */
const READOUT_EXPIRY_MS = 4000;
/** How many key events the panel keeps for the report. */
const EVENT_LOG_SIZE = 60;
/** How many rollover attempts the panel keeps. */
const ATTEMPT_LIMIT = 50;
/** The default wait window, in milliseconds. */
const DEFAULT_WINDOW_MS = 1200;

/** One finished rollover attempt, in the shape the tool expects. */
interface Attempt {
  expected: string[];
  pressed: string[];
  at: string;
}

/** The rollover attempt currently in progress. */
interface LiveAttempt {
  /** The expected codes that were down at the same time, at the best moment. */
  best: string[];
  /** Every expected code that received a keydown during the attempt. */
  arrived: Set<string>;
  /** Timer that closes the attempt after the wait window. */
  timer: number | null;
}

/** True when the event came from a field the user is typing into. */
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

/** Mount the keyboard tester into a `[data-keyboard-panel]` element. */
export function mountKeyboardTesterPanel(panel: HTMLElement): void {
  const toolId = panel.dataset.toolId || 'keyboard-tester';

  const keyHost = panel.querySelector<HTMLElement>('[data-kb-keys]')!;
  const previewEl = panel.querySelector<HTMLElement>('[data-kb-preview]')!;
  const readout = panel.querySelector<HTMLElement>('[data-kb-readout]')!;
  const modifierList = panel.querySelector<HTMLElement>('[data-kb-modifiers]')!;
  const challengeSelect = panel.querySelector<HTMLSelectElement>('[data-kb-challenge]')!;
  const customInput = panel.querySelector<HTMLInputElement>('[data-kb-custom]')!;
  const useCustomBtn = panel.querySelector<HTMLButtonElement>('[data-kb-use-custom]')!;
  const windowInput = panel.querySelector<HTMLInputElement>('[data-kb-window]')!;
  const historyInput = panel.querySelector<HTMLInputElement>('[data-kb-history]')!;
  const timestampsInput = panel.querySelector<HTMLInputElement>('[data-kb-timestamps]')!;
  const pinInput = panel.querySelector<HTMLInputElement>('[data-kb-pin]')!;
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-kb-start]')!;
  const clearBtn = panel.querySelector<HTMLButtonElement>('[data-kb-clear]')!;
  const status = panel.querySelector<HTMLElement>('[data-kb-status]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-kb-error]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-kb-result-wrap]')!;
  const reportHost = panel.querySelector<HTMLElement>('[data-kb-report]')!;
  const statsHost = panel.querySelector<HTMLElement>('[data-kb-stats]')!;
  const notesHost = panel.querySelector<HTMLUListElement>('[data-kb-notes]')!;

  if (
    !keyHost ||
    !previewEl ||
    !readout ||
    !modifierList ||
    !challengeSelect ||
    !customInput ||
    !useCustomBtn ||
    !windowInput ||
    !historyInput ||
    !timestampsInput ||
    !pinInput ||
    !startBtn ||
    !clearBtn ||
    !status ||
    !errorBox ||
    !resultWrap ||
    !reportHost ||
    !statsHost ||
    !notesHost
  ) {
    return;
  }

  /** code → the on-screen button that represents it. */
  const buttons = new Map<string, HTMLButtonElement>();
  keyHost.querySelectorAll<HTMLButtonElement>('[data-kb-code]').forEach((btn) => {
    buttons.set(btn.dataset.kbCode!, btn);
  });

  /** The codes that are physically down right now. */
  const pressed = new Set<string>();
  /** The key events seen so far, oldest first. */
  const events: KeyEventLike[] = [];
  /** The finished rollover attempts, oldest first. */
  const attempts: Attempt[] = [];

  /** The combination the user is being asked to press. */
  let expected: string[] = [];
  /** A custom combination, or null while a preset is selected. */
  let customCodes: string[] | null = null;
  /** True while the rollover test is listening. */
  let armed = false;
  /** The rollover attempt in progress. */
  let live: LiveAttempt | null = null;
  /** Clears the readout after a released key has been visible for a while. */
  let readoutTimer: number | null = null;

  /* ------------------------------------------------------------------ */
  /*  Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  function setField(name: string, value: string): void {
    const el = readout.querySelector<HTMLElement>(`[data-kb-field="${name}"]`);
    if (el) el.textContent = value;
  }

  function setPressed(code: string, isDown: boolean): void {
    const btn = buttons.get(code);
    if (!btn) return;
    btn.dataset.pressed = isDown ? 'true' : 'false';
    btn.setAttribute('aria-pressed', isDown ? 'true' : 'false');
  }

  function setModifier(name: string, isDown: boolean): void {
    const chip = modifierList.querySelector<HTMLElement>(`[data-kb-mod="${name}"]`);
    if (!chip) return;
    chip.dataset.on = isDown ? 'true' : 'false';
    const state = chip.querySelector<HTMLElement>('[data-kb-mod-state]');
    if (state) state.textContent = isDown ? 'on' : 'off';
  }

  function setStatus(message: string): void {
    status.textContent = message;
  }

  function clearReadout(): void {
    setField('state', '—');
    setField('key', '—');
    setField('code', '—');
    setField('char', '—');
    setField('combo', '—');
    setField('repeat', '—');
    setField('modifiers', 'none');
  }

  function cancelReadoutExpiry(): void {
    if (readoutTimer !== null) {
      window.clearTimeout(readoutTimer);
      readoutTimer = null;
    }
  }

  function waitMs(): number {
    const n = Number(windowInput.value);
    if (!Number.isFinite(n)) return DEFAULT_WINDOW_MS;
    return Math.max(200, Math.round(n));
  }

  function historySize(): number {
    const n = Number(historyInput.value);
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.round(n));
  }

  /** The combination the panel is currently testing. */
  function currentExpected(): string[] {
    if (customCodes) return [...customCodes];
    const challenge = GHOSTING_CHALLENGES.find((c) => c.id === challengeSelect.value);
    return challenge ? [...challenge.codes] : [];
  }

  /** The options the tool is called with. */
  function toolOptions(): Record<string, string | number | boolean> {
    return {
      historySize: historySize(),
      includeTimestamps: timestampsInput.checked,
      rolloverWindowMs: waitMs(),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  The readout                                                        */
  /* ------------------------------------------------------------------ */

  function showEvent(description: ReturnType<typeof describeEvent>, state: 'down' | 'up'): void {
    cancelReadoutExpiry();
    setField('state', state);
    setField('key', description.key || '—');
    setField('code', description.code || '—');
    setField('char', description.character || '—');
    setField('combo', description.combo || '—');
    setField('repeat', description.repeat ? 'yes' : 'no');
    setField(
      'modifiers',
      description.modifiers.length ? description.modifiers.join(' + ') : 'none',
    );
    setModifier('shift', description.shift);
    setModifier('ctrl', description.ctrl);
    setModifier('alt', description.alt);
    setModifier('meta', description.meta);

    // The value of a key the user just released stays readable for a moment.
    if (state === 'up' && !pinInput.checked) {
      readoutTimer = window.setTimeout(() => {
        readoutTimer = null;
        clearReadout();
      }, READOUT_EXPIRY_MS);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  The rollover test                                                  */
  /* ------------------------------------------------------------------ */

  /** The expected codes that are down right now. */
  function overlap(): string[] {
    return expected.filter((code) => pressed.has(code));
  }

  function closeAttempt(): void {
    const attempt = live;
    live = null;
    if (!attempt) return;
    if (attempt.timer !== null) window.clearTimeout(attempt.timer);
    if (!expected.length) return;

    const result = evaluateGhosting(expected, attempt.best);
    attempts.push({
      expected: [...expected],
      pressed: [...attempt.best],
      at: new Date().toISOString(),
    });
    while (attempts.length > ATTEMPT_LIMIT) attempts.shift();

    if (result.pass) {
      setStatus(
        `PASS — ${formatCombination(result.expected)} registered together (${result.pressed.length} keys at once).`,
      );
    } else {
      const never = expected.filter((code) => !attempt.arrived.has(code));
      const detail = never.length
        ? `${formatCombination(never)} never arrived`
        : `${formatCombination(result.missing)} was never down at the same time as the others`;
      setStatus(
        `FAIL — ${detail}. That can be the keyboard, the operating system’s key filter or the browser, not this page.`,
      );
    }
    void refreshReport();
  }

  function trackRollover(code: string, isDown: boolean): void {
    if (!armed || !expected.length) return;

    if (!isDown) {
      // Every key of the combination has been let go of — the attempt is over.
      if (live && !expected.some((c) => pressed.has(c))) closeAttempt();
      return;
    }

    if (!live) {
      live = { best: [], arrived: new Set(), timer: null };
    }
    if (!live.arrived.has(code)) live.arrived.add(code);

    const current = overlap();
    if (current.length > live.best.length) live.best = current;

    if (live.timer !== null) window.clearTimeout(live.timer);
    live.timer = window.setTimeout(closeAttempt, waitMs());

    // Every key of the combination is down at the same moment — pass now.
    if (current.length >= expected.length) closeAttempt();
  }

  /* ------------------------------------------------------------------ */
  /*  The report                                                         */
  /* ------------------------------------------------------------------ */

  async function refreshReport(): Promise<void> {
    const session = {
      attempts,
      events,
      pressed: [...pressed],
    };
    try {
      const result = await runToolById<TextRunResult>(toolId, {
        text: JSON.stringify(session),
        options: toolOptions(),
      });
      renderTextResult(reportHost, result);
      resultWrap.hidden = false;

      statsHost.replaceChildren();
      for (const [key, value] of Object.entries(result.stats ?? {})) {
        const span = document.createElement('span');
        const label = document.createElement('span');
        label.className = 'font-medium text-[rgb(var(--text))]';
        label.textContent = `${key}:`;
        span.append(label, ` ${value}`);
        statsHost.appendChild(span);
      }

      notesHost.replaceChildren();
      for (const warning of result.warnings ?? []) {
        const li = document.createElement('li');
        li.style.color = 'rgb(var(--warning))';
        li.textContent = `⚠ ${warning}`;
        notesHost.appendChild(li);
      }
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.className = 'text-[rgb(var(--text-muted))]';
        li.textContent = note;
        notesHost.appendChild(li);
      }
      clearError(errorBox);
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'The report could not be built.', e.hint);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Key listeners                                                      */
  /* ------------------------------------------------------------------ */

  function record(event: KeyboardEvent): void {
    const entry: KeyEventLike = {
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      type: event.type,
    };
    events.push(entry);
    while (events.length > EVENT_LOG_SIZE) events.shift();
  }

  function onKeyDown(event: KeyboardEvent): void {
    const code = event.code;
    if (!code) return;
    const typing = isTextEntry(event.target);

    // Keys typed into a field of this page are not part of the test.
    if (!typing) {
      pressed.add(code);
      setPressed(code, true);
    }
    record(event);
    showEvent(describeEvent(event), 'down');

    if (!typing) trackRollover(code, true);
  }

  function onKeyUp(event: KeyboardEvent): void {
    const code = event.code;
    if (!code) return;

    // Always clear the key: a key-up can land after the focus moved into a
    // field, and a stale entry would corrupt the rollover test.
    pressed.delete(code);
    setPressed(code, false);
    record(event);
    showEvent(describeEvent(event), 'up');

    if (!isTextEntry(event.target)) trackRollover(code, false);
  }

  /** Keys released while the window was in the background never send keyup. */
  function onBlur(): void {
    for (const code of [...pressed]) setPressed(code, false);
    pressed.clear();
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);

  /* ------------------------------------------------------------------ */
  /*  Controls                                                           */
  /* ------------------------------------------------------------------ */

  function applyExpected(next: string[]): void {
    expected = next;
    if (live) {
      if (live.timer !== null) window.clearTimeout(live.timer);
      live = null;
    }
    setStatus(
      armed
        ? `Press ${formatCombination(expected)} at the same time and hold them for a moment.`
        : `Press ${formatCombination(expected)} at the same time and hold them for a moment, then start the test.`,
    );
  }

  challengeSelect.addEventListener('change', () => {
    customCodes = null;
    customInput.value = '';
    applyExpected(currentExpected());
  });

  useCustomBtn.addEventListener('click', () => {
    try {
      const codes = parseCombination(customInput.value);
      customCodes = codes;
      applyExpected(codes);
      clearError(errorBox);
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'That combination could not be read.', e.hint);
    }
  });

  customInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      useCustomBtn.click();
    }
  });

  startBtn.addEventListener('click', () => {
    armed = !armed;
    if (live) {
      if (live.timer !== null) window.clearTimeout(live.timer);
      live = null;
    }
    startBtn.textContent = armed ? 'Stop test' : 'Start test';
    startBtn.classList.toggle('btn-primary', armed);
    startBtn.classList.toggle('btn-ghost', !armed);
    setStatus(
      armed
        ? `Press ${formatCombination(expected)} at the same time and hold them for a moment.`
        : 'Idle — start the test, then press the keys of the combination at the same time.',
    );
  });

  clearBtn.addEventListener('click', () => {
    attempts.length = 0;
    events.length = 0;
    if (live) {
      if (live.timer !== null) window.clearTimeout(live.timer);
      live = null;
    }
    reportHost.replaceChildren();
    statsHost.replaceChildren();
    notesHost.replaceChildren();
    resultWrap.hidden = true;
    clearError(errorBox);
    setStatus('History cleared.');
  });

  windowInput.addEventListener('change', () => {
    void refreshReport();
  });
  historyInput.addEventListener('change', () => {
    void refreshReport();
  });
  timestampsInput.addEventListener('change', () => {
    void refreshReport();
  });

  // Activating an on-screen key previews what that physical key produces.
  keyHost.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-kb-code]');
    if (!btn) return;
    const code = btn.dataset.kbCode!;
    const character = codeToKey(code);
    previewEl.textContent = `${keyLabel(code)} (${code}) → US character “${character === ' ' ? '␣ (space)' : character}”.`;
  });

  window.addEventListener('pagehide', () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    cancelReadoutExpiry();
    if (live && live.timer !== null) window.clearTimeout(live.timer);
  });

  /* ------------------------------------------------------------------ */
  /*  Start                                                              */
  /* ------------------------------------------------------------------ */

  applyExpected(currentExpected());
  clearReadout();
}
