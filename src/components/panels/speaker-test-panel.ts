/**
 * Speaker test panel.
 *
 * Loaded on demand by `speaker-test.astro` so no audio code ships to pages
 * that do not test a speaker.
 *
 * The panel owns the browser APIs: it builds a small Web Audio graph
 * (oscillator → gain → panner → destination) and plays a test tone or a
 * log-spaced frequency sweep out of the left, right or both channels. The
 * maths — the channel → gain/pan mapping, the logarithmic slider, sweep
 * interpolation, duration parsing and the frequency→note helper — lives at the
 * top of this module so the jsdom tests can import it without a browser.
 *
 * The tone is synthesized in the tab and played straight to the output device:
 * nothing is recorded, stored or uploaded.
 */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { clamp, formatDuration } from '@/lib/format';
import { clearError, renderTextResult, showError } from '../workbench/shared';

/** The low end of the testable range, in hertz. */
export const MIN_FREQ = 20;
/** The high end of the testable range, in hertz. */
export const MAX_FREQ = 20000;
/** The shortest play the panel allows, in milliseconds. */
export const MIN_DURATION_MS = 250;
/** The longest play the panel allows, in milliseconds. */
export const MAX_DURATION_MS = 30000;
/** The default test tone, A4. */
export const DEFAULT_FREQUENCY = 440;
/** How many log-spaced steps a sweep passes through. */
export const SWEEP_STEPS = 24;
/** The listening level — deliberately modest; the panel warns about volume. */
const TEST_GAIN = 0.5;

/** Which output a test is aimed at. */
export type SpeakerChannel = 'left' | 'right' | 'both';
/** The two test shapes: a steady tone or a frequency sweep. */
export type SpeakerMode = 'tone' | 'sweep';

/** Gain and stereo pan for a chosen channel. */
export interface GainPan {
  gain: number;
  pan: number;
}

/** One finished play, in the shape the report expects. */
export interface SpeakerPlay {
  channel: SpeakerChannel;
  mode: SpeakerMode;
  /** The steady tone, or the sweep's start frequency. */
  frequency: number;
  /** The sweep's end frequency (a steady tone repeats `frequency`). */
  sweepEnd: number;
  /** How long the play ran, in milliseconds. */
  durationMs: number;
  /** When the play finished, as an ISO timestamp. */
  at: string;
}

/** The snapshot the panel hands to the tool's `run()`. */
export interface SpeakerSession {
  /** Every play finished so far, oldest first. */
  plays: SpeakerPlay[];
}

/**
 * The stereo gain and pan that aim a test at one channel.
 *
 * `left` and `right` pan hard to one side at unity gain; `both` sits in the
 * center and lifts the gain by √2, which is exactly the amount the equal-power
 * pan law takes away from a centerd signal — so every channel choice is as loud
 * as the others.
 */
export function gainAndPanForChannel(channel: SpeakerChannel): GainPan {
  switch (channel) {
    case 'left':
      return { gain: 1, pan: -1 };
    case 'right':
      return { gain: 1, pan: 1 };
    default:
      return { gain: Math.SQRT2, pan: 0 };
  }
}

/** Clamp a frequency into the testable range, falling back to A4. */
export function clampFrequency(freq: number): number {
  if (!Number.isFinite(freq)) return DEFAULT_FREQUENCY;
  return clamp(freq, MIN_FREQ, MAX_FREQ);
}

/**
 * A log-scaled slider position (0…1) → frequency. The range 20 Hz … 20 kHz is
 * three decades wide, so a linear slider would squeeze everything below 1 kHz
 * into the first 5 %, while this one gives every octave the same travel.
 */
export function sliderToFrequency(position: number): number {
  const p = clamp(position, 0, 1);
  return Math.round(MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, p));
}

/** The log-slider position (0…1) a frequency sits at — the inverse above. */
export function frequencyToSlider(freq: number): number {
  const f = clampFrequency(freq);
  return Math.log(f / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ);
}

/**
 * `steps` frequencies from `start` to `end`, evenly spaced on a log scale —
 * each successive pair is the same musical interval, so the sweep sounds even.
 * The endpoints are always included, and the list is monotonic.
 */
export function logFrequencySteps(start: number, end: number, steps: number): number[] {
  const from = clampFrequency(start);
  const to = clampFrequency(end);
  const count = Math.max(1, Math.floor(steps));
  if (count === 1) return [from];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round(from * Math.pow(to / from, i / (count - 1))));
  }
  return out;
}

/**
 * Parse a duration into milliseconds. A number is taken as milliseconds; a
 * string may carry an `ms`, `s` or `m` unit (`'1500ms'`, `'2s'`, `'0.5m'`) and
 * a bare string is read as seconds. Anything unparseable or outside the safe
 * range falls back to `fallback`.
 */
export function parseDuration(raw: string | number | undefined, fallback = 3000): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw)
      ? clamp(Math.round(raw), MIN_DURATION_MS, MAX_DURATION_MS)
      : fallback;
  }
  const text = String(raw ?? '')
    .trim()
    .toLowerCase();
  const match = /^([0-9]*\.?[0-9]+)\s*(ms|s|m)?$/.exec(text);
  if (!match) return fallback;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const unit = match[2];
  const ms = unit === 'ms' ? value : unit === 'm' ? value * 60000 : value * 1000;
  return clamp(Math.round(ms), MIN_DURATION_MS, MAX_DURATION_MS);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** The nearest note name and octave for a frequency (A4 = 440 Hz). */
export function frequencyToNote(freq: number): string {
  const f = clampFrequency(freq);
  const semitone = Math.round(12 * Math.log2(f / 440));
  // A is the 9th semitone above C, so that offset turns the note name right.
  const name = NOTE_NAMES[(((semitone + 9) % 12) + 12) % 12]!;
  const octave = 4 + Math.floor((semitone + 9) / 12);
  return `${name}${octave}`;
}

/** Format a frequency for display, switching to kHz above 1000 Hz. */
export function formatFrequency(freq: number): string {
  const f = clampFrequency(freq);
  if (f >= 1000) {
    const kHz = f / 1000;
    return `${kHz.toFixed(kHz % 1 === 0 ? 0 : 1)} kHz`;
  }
  return `${Math.round(f)} Hz`;
}

/** A human label for a channel choice, shared by the panel and the report. */
export function channelLabel(channel: SpeakerChannel): string {
  switch (channel) {
    case 'left':
      return 'Left';
    case 'right':
      return 'Right';
    default:
      return 'Both';
  }
}

/** Read the channel select. */
function readChannel(root: HTMLElement): SpeakerChannel {
  const value = (
    root.querySelector<HTMLSelectElement>('[data-sp-channel]')?.value ?? 'both'
  ).trim();
  return value === 'left' || value === 'right' ? value : 'both';
}

/** Read the mode select. */
function readMode(root: HTMLElement): SpeakerMode {
  return (root.querySelector<HTMLSelectElement>('[data-sp-mode]')?.value ?? 'tone') === 'sweep'
    ? 'sweep'
    : 'tone';
}

/** Read a frequency field, clamped into range. */
function readFrequency(root: HTMLElement, selector: string, fallback: number): number {
  const raw = root.querySelector<HTMLInputElement>(selector)?.value;
  return clampFrequency(Number(raw) || fallback);
}

/** Read the duration field. */
function readDuration(root: HTMLElement): number {
  const raw = root.querySelector<HTMLInputElement>('[data-sp-duration]')?.value;
  return parseDuration(raw, 3000);
}

/** The options the report is called with. */
function currentOptions(root: HTMLElement): OptionValues {
  const timestamps = root.querySelector<HTMLInputElement>('[data-sp-timestamps]');
  return {
    channel: readChannel(root),
    mode: readMode(root),
    frequency: readFrequency(root, '[data-sp-frequency]', DEFAULT_FREQUENCY),
    sweepStart: readFrequency(root, '[data-sp-sweep-start]', MIN_FREQ),
    sweepEnd: readFrequency(root, '[data-sp-sweep-end]', MAX_FREQ),
    duration: readDuration(root),
    includeTimestamps: timestamps ? timestamps.checked : true,
  };
}

/** The `AudioContext` constructor, including the old WebKit prefix. */
function audioContextConstructor(): typeof AudioContext | undefined {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext;
}

/** The test that is currently sounding, if any. */
interface ActiveTest {
  oscillator: OscillatorNode;
  master: GainNode;
  panner: StereoPannerNode;
  play: SpeakerPlay;
}

/** Mount the speaker test into a `[data-speaker-panel]` element. */
export function mountSpeakerTestPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'speaker-test';
  const playBtn = root.querySelector<HTMLButtonElement>('[data-sp-play]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-sp-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-sp-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-sp-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-sp-report]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-sp-notes]')!;
  const freqReadout = root.querySelector<HTMLElement>('[data-sp-freq-readout]');
  const startReadout = root.querySelector<HTMLElement>('[data-sp-sweep-start-readout]');
  const endReadout = root.querySelector<HTMLElement>('[data-sp-sweep-end-readout]');

  if (!playBtn || !stopBtn || !statusEl || !errorBox || !resultWrap || !reportEl || !notesEl) {
    return;
  }

  const Ctor = audioContextConstructor();
  let context: AudioContext | null = null;
  let active: ActiveTest | null = null;
  let disposed = false;
  const plays: SpeakerPlay[] = [];

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function setPlaying(value: boolean): void {
    playBtn.disabled = value;
    stopBtn.hidden = !value;
    playBtn.setAttribute('aria-pressed', value ? 'true' : 'false');
  }

  /* ------------------------------------------------------------------ */
  /*  Playback                                                           */
  /* ------------------------------------------------------------------ */

  /** Silence and tear down the test that is sounding, logging it as played. */
  function stopActive(reason?: string): void {
    if (!active) return;
    const { oscillator, master, play } = active;
    active = null;
    oscillator.onended = null;
    const now = context?.currentTime ?? 0;
    try {
      // A short exponential ramp down, then stop — no click.
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, 0.01);
      oscillator.stop(now + 0.1);
    } catch {
      // The nodes may already be gone; there is nothing left to silence.
    }
    plays.push(play);
    setPlaying(false);
    if (reason) announce(reason);
    void refreshReport();
  }

  /** Close the shared `AudioContext` (it is recreated on the next play). */
  function closeContext(): void {
    if (!context) return;
    try {
      void context.close();
    } catch {
      // Already closed.
    }
    context = null;
  }

  /**
   * Play the chosen test.
   *
   * A tone is a single oscillator held for the whole duration. A sweep is the
   * same oscillator stepped through the frequencies `logFrequencySteps`
   * returns, with an exponential ramp between each pair: an exponential ramp
   * through equally spaced log steps *is* the smooth, musically even sweep the
   * slider promises. Both edges are faded by the master gain.
   */
  function startTest(): void {
    if (disposed) return;
    if (!Ctor) {
      announce('Web Audio is not available in this browser.');
      return;
    }
    clearError(errorBox);
    stopActive();

    if (!context) context = new Ctor();
    const ctx = context ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();

    const channel = readChannel(root);
    const mode = readMode(root);
    const durationMs = readDuration(root);
    const startFreq =
      mode === 'sweep'
        ? readFrequency(root, '[data-sp-sweep-start]', MIN_FREQ)
        : readFrequency(root, '[data-sp-frequency]', DEFAULT_FREQUENCY);
    const endFreq =
      mode === 'sweep' ? readFrequency(root, '[data-sp-sweep-end]', MAX_FREQ) : startFreq;

    const { gain, pan } = gainAndPanForChannel(channel);
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    const master = ctx.createGain();
    const panner = ctx.createStereoPanner();

    oscillator.connect(master);
    master.connect(panner);
    panner.connect(ctx.destination);

    const t0 = ctx.currentTime + 0.05;
    const seconds = durationMs / 1000;
    const fadeIn = Math.min(0.05, seconds / 4);
    const fadeOut = Math.min(0.15, seconds / 4);
    const end = t0 + seconds;
    const level = gain * TEST_GAIN;

    panner.pan.setValueAtTime(pan, t0);
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(level, t0 + fadeIn);
    master.gain.setValueAtTime(level, Math.max(t0 + fadeIn, end - fadeOut));
    master.gain.linearRampToValueAtTime(0, end);

    if (mode === 'sweep') {
      const steps = logFrequencySteps(startFreq, endFreq, SWEEP_STEPS);
      const stepSeconds = seconds / (steps.length - 1);
      oscillator.frequency.setValueAtTime(steps[0]!, t0);
      for (let i = 1; i < steps.length; i++) {
        oscillator.frequency.exponentialRampToValueAtTime(steps[i]!, t0 + i * stepSeconds);
      }
    } else {
      oscillator.frequency.setValueAtTime(startFreq, t0);
    }

    const play: SpeakerPlay = {
      channel,
      mode,
      frequency: startFreq,
      sweepEnd: endFreq,
      durationMs,
      at: new Date().toISOString(),
    };
    active = { oscillator, master, panner, play };
    oscillator.onended = () => {
      if (!active || active.oscillator !== oscillator) return;
      active = null;
      try {
        oscillator.disconnect();
        master.disconnect();
        panner.disconnect();
      } catch {
        // Already disconnected.
      }
      plays.push(play);
      setPlaying(false);
      announce(
        mode === 'sweep'
          ? `Swept ${formatFrequency(startFreq)} to ${formatFrequency(endFreq)}.`
          : `Played ${formatFrequency(startFreq)} (${frequencyToNote(startFreq)}).`,
      );
      void refreshReport();
    };

    oscillator.start(t0);
    oscillator.stop(end + 0.02);
    setPlaying(true);
    announce(
      mode === 'sweep'
        ? `Sweeping ${formatFrequency(startFreq)} to ${formatFrequency(endFreq)} for ${formatDuration(durationMs)}…`
        : `Playing ${formatFrequency(startFreq)} (${frequencyToNote(startFreq)}) for ${formatDuration(durationMs)}…`,
    );
  }

  /* ------------------------------------------------------------------ */
  /*  The report                                                         */
  /* ------------------------------------------------------------------ */

  async function refreshReport(): Promise<void> {
    try {
      const result = await runToolById<TextRunResult>(toolId, {
        text: JSON.stringify({ plays } satisfies SpeakerSession),
        options: currentOptions(root),
      });
      renderTextResult(reportEl, result);
      resultWrap.hidden = false;
      notesEl.replaceChildren();
      for (const warning of result.warnings ?? []) {
        const li = document.createElement('li');
        li.style.color = 'rgb(var(--warning))';
        li.textContent = `⚠ ${warning}`;
        notesEl.appendChild(li);
      }
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.className = 'text-[rgb(var(--text-muted))]';
        li.textContent = note;
        notesEl.appendChild(li);
      }
      clearError(errorBox);
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'The report could not be built.', e.hint);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Controls                                                           */
  /* ------------------------------------------------------------------ */

  /** Keep a number field and its log slider in step, with a live readout. */
  function bindLogPair(
    numberInput: HTMLInputElement | null,
    slider: HTMLInputElement | null,
    readout: HTMLElement | null,
  ): void {
    if (!numberInput || !slider) return;
    const show = (hz: number): void => {
      if (readout) readout.textContent = `${formatFrequency(hz)} · ${frequencyToNote(hz)}`;
    };
    const fromNumber = (): void => {
      const hz = clampFrequency(Number(numberInput.value));
      slider.value = String(frequencyToSlider(hz) * 100);
      show(hz);
    };
    const fromSlider = (): void => {
      const hz = sliderToFrequency(Number(slider.value) / 100);
      numberInput.value = String(hz);
      show(hz);
    };
    numberInput.addEventListener('input', fromNumber);
    numberInput.addEventListener('change', fromNumber);
    slider.addEventListener('input', fromSlider);
    fromNumber();
  }

  bindLogPair(
    root.querySelector<HTMLInputElement>('[data-sp-frequency]'),
    root.querySelector<HTMLInputElement>('[data-sp-frequency-slider]'),
    freqReadout,
  );
  bindLogPair(
    root.querySelector<HTMLInputElement>('[data-sp-sweep-start]'),
    root.querySelector<HTMLInputElement>('[data-sp-sweep-start-slider]'),
    startReadout,
  );
  bindLogPair(
    root.querySelector<HTMLInputElement>('[data-sp-sweep-end]'),
    root.querySelector<HTMLInputElement>('[data-sp-sweep-end-slider]'),
    endReadout,
  );

  const modeSelect = root.querySelector<HTMLSelectElement>('[data-sp-mode]');
  const sweepWrap = root.querySelector<HTMLElement>('[data-sp-sweep]');
  const toneWrap = root.querySelector<HTMLElement>('[data-sp-tone-controls]');
  if (modeSelect) {
    const syncMode = (): void => {
      const sweep = modeSelect.value === 'sweep';
      if (sweepWrap) sweepWrap.hidden = !sweep;
      if (toneWrap) toneWrap.hidden = sweep;
    };
    modeSelect.addEventListener('change', syncMode);
    syncMode();
  }

  const durationInput = root.querySelector<HTMLInputElement>('[data-sp-duration]');
  const durationHint = root.querySelector<HTMLElement>('[data-sp-duration-hint]');
  if (durationInput && durationHint) {
    const syncDuration = (): void => {
      durationHint.textContent = `= ${readDuration(root)} ms`;
    };
    durationInput.addEventListener('input', syncDuration);
    durationInput.addEventListener('change', syncDuration);
    syncDuration();
  }

  root.querySelector<HTMLButtonElement>('[data-sp-clear]')?.addEventListener('click', () => {
    plays.length = 0;
    reportEl.replaceChildren();
    notesEl.replaceChildren();
    resultWrap.hidden = true;
    clearError(errorBox);
    announce('Log cleared.');
  });

  root
    .querySelector<HTMLInputElement>('[data-sp-timestamps]')
    ?.addEventListener('change', () => void refreshReport());

  playBtn.addEventListener('click', () => startTest());
  stopBtn.addEventListener('click', () => {
    if (!active) {
      announce('Nothing is playing.');
      return;
    }
    stopActive('Stopped.');
  });

  /* ------------------------------------------------------------------ */
  /*  Teardown                                                           */
  /* ------------------------------------------------------------------ */

  // A tone must never keep sounding from a hidden tab, and nothing must be
  // left running when the page goes away.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active) stopActive('Stopped — the tab went to the background.');
  });
  const teardown = (): void => {
    disposed = true;
    stopActive();
    closeContext();
  };
  window.addEventListener('pagehide', teardown);
  window.addEventListener('beforeunload', teardown, { once: true });

  /* ------------------------------------------------------------------ */
  /*  Start                                                              */
  /* ------------------------------------------------------------------ */

  if (!Ctor) {
    playBtn.disabled = true;
    setPlaying(false);
    showError(
      errorBox,
      'This browser cannot play tones.',
      'Speaker testing needs Web Audio — try a recent Chrome, Edge, Firefox or Safari.',
    );
    announce('Web Audio is not available in this browser.');
  } else {
    setPlaying(false);
    announce('Idle — choose a channel and press Play. Keep the volume low to start with.');
  }
}
