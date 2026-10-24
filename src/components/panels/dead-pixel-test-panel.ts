/**
 * Dead pixel test panel.
 *
 * Loaded on demand by `dead-pixel-test.astro` so no Fullscreen or keyboard
 * code ships to pages that do not test a screen.
 *
 * The panel owns the browser APIs — the Fullscreen API, the colour cycling
 * timer and the key listeners — and draws one solid colour at a time. The
 * sequence, the wraparound stepping, the auto-cycle schedule and the key
 * mapping all come from `@/tools/device/dead-pixel-test.core` so they are
 * testable without a browser.
 *
 * Fullscreen is only ever requested from a user gesture (clicking the start
 * button, or pressing Enter on it), never on load. When the user leaves
 * fullscreen the panel hands the recorded sweep to the tool as a report.
 * Nothing is uploaded and nothing is stored.
 */
import type { TextRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import {
  clearError,
  readOptions,
  renderTextResult,
  showError,
} from '@/components/workbench/shared';
import {
  DEAD_PIXEL_SEQUENCE,
  cycleDelayMs,
  keyToAction,
  nextIndex,
  prevIndex,
  type TestColour,
} from '@/tools/device/dead-pixel-test.core';

/** The default auto-cycle interval, milliseconds (matches the meta default). */
const DEFAULT_INTERVAL_MS = 5000;
/** The shortest and longest allowed auto-cycle interval, milliseconds. */
const INTERVAL_MIN_MS = 500;
const INTERVAL_MAX_MS = 60000;

/** One colour shown during the session, in the shape the tool report reads. */
interface ShownColour {
  name: string;
  value: string;
  shownMs: number;
  suspect?: boolean;
}

/** Whether the Fullscreen API is available and enabled in this browser. */
function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

/** Request fullscreen on an element; resolves true when it was granted. */
async function enterFullscreen(el: HTMLElement): Promise<boolean> {
  const request = el.requestFullscreen?.bind(el) as (() => Promise<void>) | undefined;
  if (!request) return false;
  try {
    await request();
    return true;
  } catch {
    return false;
  }
}

/** Leave fullscreen if the browser allows it. */
function exitFullscreen(): void {
  if (typeof document === 'undefined' || !document.fullscreenElement) return;
  const exit = document.exitFullscreen as (() => Promise<void>) | undefined;
  if (!exit) return;
  try {
    void exit.call(document).catch(() => undefined);
  } catch {
    /* the browser refused to leave fullscreen — nothing more we can do */
  }
}

/** A readable foreground for a flat background colour. */
export function readableOn(bg: string): string {
  const hex = bg.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return '#fff';
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#000' : '#fff';
}

/** Mount the dead-pixel panel into a `[data-dead-pixel-panel]` element. */
export function mountDeadPixelPanel(panel: HTMLElement): void {
  const toolId = panel.dataset.toolId || 'dead-pixel-test';

  const stage = panel.querySelector<HTMLElement>('[data-dp-stage]')!;
  const colourLabel = panel.querySelector<HTMLElement>('[data-dp-colour]')!;
  const valueLabel = panel.querySelector<HTMLElement>('[data-dp-value]')!;
  const stepLabel = panel.querySelector<HTMLElement>('[data-dp-step]')!;
  const status = panel.querySelector<HTMLElement>('[data-dp-status]')!;
  const hint = panel.querySelector<HTMLElement>('[data-dp-hint]')!;
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-dp-start]')!;
  const prevBtn = panel.querySelector<HTMLButtonElement>('[data-dp-prev]')!;
  const nextBtn = panel.querySelector<HTMLButtonElement>('[data-dp-next]')!;
  const toggleBtn = panel.querySelector<HTMLButtonElement>('[data-dp-toggle]')!;
  const optionsHost = panel.querySelector<HTMLElement>('[data-dp-options]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-dp-result-wrap]')!;
  const reportHost = panel.querySelector<HTMLElement>('[data-dp-report]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-dp-error]')!;

  if (
    !stage ||
    !colourLabel ||
    !valueLabel ||
    !stepLabel ||
    !status ||
    !hint ||
    !startBtn ||
    !prevBtn ||
    !nextBtn ||
    !toggleBtn ||
    !optionsHost ||
    !resultWrap ||
    !reportHost ||
    !errorBox
  ) {
    return;
  }

  const length = DEAD_PIXEL_SEQUENCE.length;
  /** The colour currently on the preview stage. */
  let index = 0;
  /** True while fullscreen is showing a solid colour. */
  let active = false;
  /** True while the auto-cycle is running. */
  let auto = false;
  /** The colours shown so far, in the order they appeared. */
  const shown: ShownColour[] = [];
  /** When the current colour was put on screen (ms). */
  let shownAt = 0;
  /** The auto-cycle timer. */
  let timer: number | null = null;

  /* ------------------------------------------------------------------ */
  /*  Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  /** The current auto-cycle interval from the options, clamped. */
  function intervalMs(): number {
    const value = Number(readOptions(optionsHost).intervalMs);
    if (!Number.isFinite(value)) return DEFAULT_INTERVAL_MS;
    return Math.min(INTERVAL_MAX_MS, Math.max(INTERVAL_MIN_MS, Math.round(value)));
  }

  function currentColour(): TestColour {
    return DEAD_PIXEL_SEQUENCE[index] ?? DEAD_PIXEL_SEQUENCE[0]!;
  }

  function setStage(): void {
    const colour = currentColour();
    colourLabel.textContent = colour.name;
    valueLabel.textContent = colour.value;
    stepLabel.textContent = `${index + 1} / ${length}`;
    stage.style.backgroundColor = colour.value;
    stage.style.color = readableOn(colour.value);
  }

  function setStatus(message: string): void {
    status.textContent = message;
  }

  /** Close the current colour's stopwatch and start a new entry for it. */
  function recordCurrent(): void {
    const now = Date.now();
    const previous = shown[shown.length - 1];
    if (previous) previous.shownMs = Math.max(0, now - shownAt);
    shown.push({ name: currentColour().name, value: currentColour().value, shownMs: 0 });
    shownAt = now;
  }

  function cancelTimer(): void {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleAdvance(): void {
    cancelTimer();
    if (!active || !auto) return;
    const delay = cycleDelayMs(Date.now(), shownAt, intervalMs());
    timer = window.setTimeout(() => {
      timer = null;
      stepTo(nextIndex(index, length));
    }, delay);
  }

  /* ------------------------------------------------------------------ */
  /*  Stepping                                                           */
  /* ------------------------------------------------------------------ */

  function stepTo(next: number): void {
    if (next !== index) recordCurrent();
    index = next;
    setStage();
    setStatus(currentColour().name);
    scheduleAdvance();
  }

  function stepForward(): void {
    stepTo(nextIndex(index, length));
  }

  function stepBackward(): void {
    stepTo(prevIndex(index, length));
  }

  /** Turn the auto-cycle on or off, keeping the button and timer in step. */
  function setAuto(next: boolean): void {
    auto = next;
    toggleBtn.textContent = next ? 'Pause auto-cycle' : 'Auto-cycle';
    toggleBtn.classList.toggle('btn-primary', next);
    toggleBtn.classList.toggle('btn-ghost', !next);
    if (next) {
      shownAt = Date.now();
      scheduleAdvance();
    } else {
      cancelTimer();
    }
  }

  function toggleAuto(): void {
    setAuto(!auto);
    setStatus(`${auto ? 'Auto-cycle on' : 'Auto-cycle off'} — ${currentColour().name}`);
  }

  /* ------------------------------------------------------------------ */
  /*  Fullscreen                                                         */
  /* ------------------------------------------------------------------ */

  function handleFullscreenChange(): void {
    const isFullscreen = document.fullscreenElement === stage;
    if (isFullscreen === active) return;
    active = isFullscreen;
    hint.hidden = !active;
    if (active) {
      startBtn.textContent = 'Leave fullscreen';
      shown.length = 0;
      shownAt = Date.now();
      shown.push({ name: currentColour().name, value: currentColour().value, shownMs: 0 });
      setAuto(readOptions(optionsHost).autoCycle === true);
      setStatus(`${currentColour().name} — sweep with the arrow keys.`);
    } else {
      startBtn.textContent = 'Start fullscreen';
      cancelTimer();
      setAuto(false);
      setStatus('Fullscreen ended — the report of your sweep is below.');
      void refreshReport();
    }
  }

  function startStop(): void {
    if (active) {
      exitFullscreen();
      return;
    }
    if (!fullscreenSupported()) {
      showError(
        errorBox,
        'Your browser does not support the Fullscreen API.',
        'Try a recent Chrome, Edge or Firefox.',
      );
      return;
    }
    clearError(errorBox);
    void enterFullscreen(stage).then((entered) => {
      if (entered || document.fullscreenElement === stage) {
        handleFullscreenChange();
      } else {
        showError(
          errorBox,
          'Fullscreen was refused by the browser.',
          'Click anywhere on the page, then press Start fullscreen again.',
        );
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  The report                                                         */
  /* ------------------------------------------------------------------ */

  async function refreshReport(): Promise<void> {
    const previous = shown[shown.length - 1];
    if (previous) previous.shownMs = Math.max(0, Date.now() - shownAt);
    const session = { shown, auto, fullscreen: true };
    try {
      const result = await runToolById<TextRunResult>(toolId, {
        text: JSON.stringify(session),
        options: readOptions(optionsHost),
      });
      renderTextResult(reportHost, result);
      resultWrap.hidden = false;
      clearError(errorBox);
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'The report could not be built.', e.hint);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Listeners                                                          */
  /* ------------------------------------------------------------------ */

  function onKeyDown(event: KeyboardEvent): void {
    const action = keyToAction(event.key);
    // The sweep keys only mean something while the solid colour owns the
    // screen — otherwise they belong to the page.
    if (!action || !active) return;
    if (action === 'next') {
      event.preventDefault();
      stepForward();
    } else if (action === 'prev') {
      event.preventDefault();
      stepBackward();
    } else if (action === 'toggle-auto') {
      event.preventDefault();
      toggleAuto();
    } else if (action === 'exit') {
      exitFullscreen();
    }
  }

  function onOptionsChange(): void {
    if (active && auto) scheduleAdvance();
  }

  function onPageHide(): void {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    window.removeEventListener('keydown', onKeyDown);
    optionsHost.removeEventListener('change', onOptionsChange);
    window.removeEventListener('pagehide', onPageHide);
    cancelTimer();
    exitFullscreen();
  }

  startBtn.addEventListener('click', startStop);
  prevBtn.addEventListener('click', stepBackward);
  nextBtn.addEventListener('click', stepForward);
  toggleBtn.addEventListener('click', toggleAuto);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('keydown', onKeyDown);
  optionsHost.addEventListener('change', onOptionsChange);
  window.addEventListener('pagehide', onPageHide);

  /* ------------------------------------------------------------------ */
  /*  Start                                                              */
  /* ------------------------------------------------------------------ */

  setStage();
  setStatus(
    fullscreenSupported()
      ? 'Press Start to enter fullscreen, then sweep with the arrow keys.'
      : 'Fullscreen is not available here — step the colours on this preview.',
  );
  toggleBtn.disabled = !fullscreenSupported();
}
