/**
 * The BPM detector panel and its tempo maths.
 *
 * The browser owns the inputs — an audio `<input type="file">` and the
 * microphone via `getUserMedia` — while everything worth testing lives in the
 * pure functions below the header. The pipeline is:
 *
 *   1. **Mono mix** — average the channels to one signal.
 *   2. **Onset strength (spectral flux)** — a short-time Fourier transform and,
 *      per frame, the half-wave-rectified sum of magnitude increases. Each
 *      transient (a drum hit, a bass pluck) pushes the flux up sharply, so the
 *      flux array is a rough impulse train at the beat rate.
 *   3. **Autocorrelation** — normalised autocorrelation of the flux envelope.
 *      The lag (in frames) with the strongest peak inside the allowed BPM
 *      window is the beat period.
 *   4. **Confidence** — how much the chosen lag stands out from the rest of the
 *      autocorrelation in the window.
 *
 * A tap-tempo fallback averages the intervals between manual taps and reports
 * the same `{ bpm, confidence }` shape, so the UI only has to render one result
 * type.
 */
import type { FileRunResult, TextRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { decodeFile } from '@/tools/audio/lib';
import { clamp } from '@/lib/format';
import { clearError, renderTextResult, showError } from '../workbench/shared';

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/** The BPM window the detector searches. Matches `meta.options` defaults. */
export interface TempoOptions {
  /** Slowest BPM to consider. */
  minBpm: number;
  /** Fastest BPM to consider. */
  maxBpm: number;
}

/** FFT frame size in samples. A power of two. */
const FFTSIZE = 2048;
/** Hop between FFT frames, in samples. */
const HOP = 512;

/** A detected tempo and how strongly it was preferred. */
export interface TempoResult {
  /** Beats per minute. */
  bpm: number;
  /** 0..1 — how much the beat period stood out in the autocorrelation. */
  confidence: number;
  /** The detected lag, in frames of the onset envelope. */
  lag: number;
  /** The octave neighbour not chosen, if inside 30..300 BPM. */
  alternate?: number;
  /** Human label for `alternate`. */
  alternateKind?: 'double' | 'half';
}

/* -------------------------------------------------------------------------- */
/*  Mono mix                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Average `Float32Array` channels into a single mono signal. Channels are the
 * same length (audio decoders guarantee it); shorter ones are zero-padded.
 */
export function monoMix(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const length = Math.max(...channels.map((c) => c.length));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Onset strength — spectral flux                                            */
/* -------------------------------------------------------------------------- */

/**
 * A minimal real-input radix-2 FFT (iterative Cooley–Tukey). The panel needs it
 * on the main thread to avoid pulling in the whole Web Audio graph, but the
 * function itself is pure and is what the unit tests feed a synthetic click
 * track through. `samples` must be a power-of-two length. Returns a full-length
 * complex pair interleaved as `[re0, im0, re1, im1, …]`.
 */
export function fftReal(samples: Float32Array): Float64Array {
  const n = samples.length;
  if ((n & (n - 1)) !== 0) throw new Error('fftReal needs a power-of-two length');
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) out[i * 2] = samples[i]!;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const re = out[i * 2]!;
      const im = out[i * 2 + 1]!;
      out[i * 2] = out[j * 2]!;
      out[i * 2 + 1] = out[j * 2 + 1]!;
      out[j * 2] = re;
      out[j * 2 + 1] = im;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const aRe = out[(i + k) * 2]!;
        const aIm = out[(i + k) * 2 + 1]!;
        const bRe = out[(i + k + half) * 2]!;
        const bIm = out[(i + k + half) * 2 + 1]!;
        const tRe = bRe * curRe - bIm * curIm;
        const tIm = bRe * curIm + bIm * curRe;
        out[(i + k) * 2] = aRe + tRe;
        out[(i + k) * 2 + 1] = aIm + tIm;
        out[(i + k + half) * 2] = aRe - tRe;
        out[(i + k + half) * 2 + 1] = aIm - tIm;
        const nextRe = wRe * curRe - wIm * curIm;
        curIm = wRe * curIm + wIm * curRe;
        curRe = nextRe;
      }
    }
  }
  return out;
}

/**
 * Compute the spectral-flux onset envelope of a mono signal.
 *
 * Returns the per-frame onset strength (one value every `HOP` samples) and the
 * effective frame rate in Hz, so callers can turn a lag in frames into a BPM.
 */
export function spectralFlux(
  channel: Float32Array,
  sampleRate: number,
): { flux: Float32Array; frameRate: number } {
  const usable = Math.max(0, channel.length - FFTSIZE);
  const frames = Math.floor(usable / HOP) + 1;
  const flux = new Float32Array(frames);
  const frameRate = sampleRate / HOP;

  const window = new Float32Array(FFTSIZE);
  for (let i = 0; i < FFTSIZE; i++) {
    // Hann window.
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFTSIZE - 1)));
  }

  let prevMag = new Float64Array(FFTSIZE / 2 + 1);
  for (let f = 0; f < frames; f++) {
    const frame = new Float32Array(FFTSIZE);
    const start = f * HOP;
    for (let i = 0; i < FFTSIZE; i++) frame[i] = (channel[start + i] ?? 0) * window[i]!;
    const spectrum = fftReal(frame);
    const mag = new Float64Array(FFTSIZE / 2 + 1);
    for (let k = 0; k <= FFTSIZE / 2; k++) {
      const re = spectrum[k * 2] ?? 0;
      const im = spectrum[k * 2 + 1] ?? 0;
      mag[k] = Math.hypot(re, im);
    }
    // Half-wave-rectified spectral flux: only count magnitude increases.
    let sum = 0;
    for (let k = 0; k <= FFTSIZE / 2; k++) {
      const d = (mag[k] ?? 0) - (prevMag[k] ?? 0);
      if (d > 0) sum += d;
    }
    flux[f] = sum;
    prevMag = mag;
  }

  return { flux, frameRate };
}

/* -------------------------------------------------------------------------- */
/*  Autocorrelation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Mean-removed autocorrelation of `x` up to `maxLag` lags (inclusive).
 * `ac[0]` is always 1; later values compare the signal against itself shifted
 * by `lag`.
 */
export function autocorrelate(x: Float32Array, maxLag: number): Float32Array {
  const n = x.length;
  const out = new Float32Array(maxLag + 1);
  if (n === 0) return out;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i]!;
  mean /= n;
  let denom = 0;
  for (let i = 0; i < n; i++) {
    const d = (x[i] ?? 0) - mean;
    denom += d * d;
  }
  if (denom === 0) return out;
  out[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += ((x[i] ?? 0) - mean) * ((x[i + lag] ?? 0) - mean);
    }
    out[lag] = sum / denom;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Tempo estimation                                                          */
/* -------------------------------------------------------------------------- */

/** Turn a lag in onset frames into a BPM at a given frame rate. */
export function bpmFromLag(lag: number, frameRate: number): number {
  if (lag <= 0) return 0;
  return (60 * frameRate) / lag;
}

/** The lag (in frames) whose period gives `bpm` at `frameRate`. */
export function lagFromBpm(bpm: number, frameRate: number): number {
  if (bpm <= 0) return 0;
  return (60 * frameRate) / bpm;
}

/** The nearest octave (×2 or ÷2) of `value` that lands inside `[min, max]`. */
function nearestInRange(value: number, min: number, max: number): number {
  let v = value;
  while (v < min) v *= 2;
  while (v > max) v /= 2;
  return v;
}

/**
 * Below this confidence the autocorrelation has no clear winner (silence, a
 * flat envelope, or a tempo whose period is outside the window). The detector
 * then reports no tempo instead of an arbitrary lag that tied with the rest.
 */
const MIN_TEMPO_CONFIDENCE = 0.05;

/**
 * Detect the tempo of a mono signal. Looks up the autocorrelation peak of the
 * spectral-flux envelope inside the `[minBpm, maxBpm]` lag window, then snaps
 * the chosen lag to the strongest of itself / its octave neighbours so a
 * half-tempo click track does not read as double speed.
 */
export function detectTempo(
  channel: Float32Array,
  sampleRate: number,
  options: TempoOptions,
): TempoResult {
  const { flux, frameRate } = spectralFlux(channel, sampleRate);
  if (flux.length < 4) {
    return { bpm: 0, confidence: 0, lag: 0 };
  }

  const minLagF = lagFromBpm(options.maxBpm, frameRate);
  const maxLagF = lagFromBpm(options.minBpm, frameRate);
  const maxLagInt = Math.max(1, Math.min(flux.length - 1, Math.round(maxLagF)));
  const minLagInt = Math.max(1, Math.min(maxLagInt, Math.round(minLagF)));

  const ac = autocorrelate(flux, maxLagInt);
  if (ac.length === 0) return { bpm: 0, confidence: 0, lag: 0 };

  let bestLag = minLagInt;
  let bestValue = -Infinity;
  for (let lag = minLagInt; lag <= maxLagInt; lag++) {
    const v = ac[lag] ?? 0;
    if (v > bestValue) {
      bestValue = v;
      bestLag = lag;
    }
  }

  // Base confidence: how the winning peak compares to the mean of the window.
  let sum = 0;
  for (let lag = minLagInt; lag <= maxLagInt; lag++) sum += ac[lag] ?? 0;
  const mean = sum / (maxLagInt - minLagInt + 1);
  const confidence = bestValue > mean ? clamp((bestValue - mean) / (1 - mean), 0, 1) : 0;

  // A flat autocorrelation means there is no beat to report.
  if (confidence < MIN_TEMPO_CONFIDENCE) {
    return { bpm: 0, confidence, lag: 0 };
  }

  const bpm = bpmFromLag(bestLag, frameRate);
  const snapped = nearestInRange(bpm, options.minBpm, options.maxBpm);
  const finalLag = Math.round(lagFromBpm(snapped, frameRate));

  let alternate: number | undefined;
  let alternateKind: 'double' | 'half' | undefined;
  const doubleBpm = snapped * 2;
  const halfBpm = snapped / 2;
  if (doubleBpm >= 30 && doubleBpm <= 300) {
    alternate = Math.round(doubleBpm);
    alternateKind = 'double';
  } else if (halfBpm >= 30 && halfBpm <= 300) {
    alternate = Math.round(halfBpm);
    alternateKind = 'half';
  }

  return { bpm: Math.round(snapped), confidence, lag: finalLag, alternate, alternateKind };
}

/* -------------------------------------------------------------------------- */
/*  Tap tempo                                                                 */
/* -------------------------------------------------------------------------- */

/** The slowest tempo a tap interval still counts as a beat. */
const TAP_MIN_BPM = 20;
/** The fastest tempo a tap interval still counts as a beat. */
const TAP_MAX_BPM = 300;
/** How many recent taps are kept for averaging. */
const TAP_MAX_COUNT = 12;

/**
 * Add a tap at `nowMs` (a `performance.now()`-style timestamp) to the running
 * list. A tap that is too close to or too far from the previous one
 * starts a fresh run. Returns the newest list, capped at `TAP_MAX_COUNT`.
 */
export function addTap(taps: number[], nowMs: number): number[] {
  const next = taps.slice();
  next.push(nowMs);
  if (next.length > 1) {
    const last = next[next.length - 1]!;
    const prev = next[next.length - 2]!;
    const intervalMs = last - prev;
    if (intervalMs < 60000 / TAP_MAX_BPM || intervalMs > 60000 / TAP_MIN_BPM) {
      // Out of tempo range — start a fresh run.
      return [nowMs];
    }
  }
  if (next.length > TAP_MAX_COUNT) next.splice(0, next.length - TAP_MAX_COUNT);
  return next;
}

/**
 * Average the tap list into a BPM. Needs at least two taps within range.
 * Uses the median interval, which is robust to a single mis-timed tap.
 * Returns 0 when there are not enough valid taps.
 */
export function averageTapTempo(taps: number[]): number {
  if (taps.length < 2) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) {
    const interval = taps[i]! - taps[i - 1]!;
    const bpm = 60000 / interval;
    if (bpm >= TAP_MIN_BPM && bpm <= TAP_MAX_BPM) intervals.push(interval);
  }
  if (intervals.length === 0) return 0;
  const sorted = intervals.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(60000 / median);
}

/** Tap-tempo confidence — 1.0 once we have enough taps, falling off below 4. */
export function tapConfidence(taps: number[]): number {
  if (taps.length < 2) return 0;
  return clamp((taps.length - 1) / 4, 0, 1);
}

/** The live tap readout for the status line, e.g. "4 taps · 118 BPM". */
export function tapStatus(taps: number[]): string {
  const bpm = averageTapTempo(taps);
  if (!bpm) return `${taps.length} tap${taps.length === 1 ? '' : 's'} — keep tapping`;
  return `${taps.length} taps · ${bpm} BPM`;
}

/* -------------------------------------------------------------------------- */
/*  Tool result                                                                */
/* -------------------------------------------------------------------------- */

/** Coerce caller option values (possibly strings) into a `TempoOptions`. */
export function readTempoOptions(values: Record<string, string | number | boolean>): TempoOptions {
  const minBpm = Number(values.minBpm ?? 70);
  const maxBpm = Number(values.maxBpm ?? 180);
  return {
    minBpm: Number.isFinite(minBpm) && minBpm > 0 ? minBpm : 70,
    maxBpm: Number.isFinite(maxBpm) && maxBpm > 0 ? maxBpm : 180,
  };
}

/** Turn a `TempoResult` into a copyable plain-text report. */
export function formatTempoReport(result: TempoResult): string {
  const confidence = `Confidence  ${Math.round(result.confidence * 100)}%`;
  if (result.bpm <= 0) {
    return `No clear tempo found.\n${confidence}`;
  }
  const lines = [`BPM  ${result.bpm}`, confidence];
  if (result.alternate && result.alternateKind) {
    lines.push(
      result.alternateKind === 'double'
        ? `Could also be ${result.alternate} BPM (double time)`
        : `Could also be ${result.alternate} BPM (half time)`,
    );
  }
  return lines.join('\n');
}

/** Build the `TextRunResult` the tool reports for a tempo. */
export function tempoReport(result: TempoResult): TextRunResult {
  const notes: string[] = [];
  if (result.bpm <= 0) {
    notes.push('No clear beat in this window — widen the BPM range, or tap the tempo by hand.');
  } else if (result.alternate && result.alternateKind) {
    notes.push(
      result.alternateKind === 'double'
        ? `Doubling the tempo gives ${result.alternate} BPM.`
        : `Halving the tempo gives ${result.alternate} BPM.`,
    );
  }
  if (result.bpm > 0 && result.confidence < 0.4) {
    notes.push('Low confidence — try a cleaner file, or use the tap tempo for a manual reading.');
  }
  return {
    output: formatTempoReport(result),
    render: 'text',
    stats: { bpm: result.bpm, confidence: `${Math.round(result.confidence * 100)}%` },
    notes,
  };
}

/** Decode a file and return the detected tempo as a `FileRunResult` report. */
export async function analyzeFile(file: File, options: TempoOptions): Promise<FileRunResult> {
  const decoded = await decodeFile(file);
  const mono = monoMix(decoded.channels);
  const result = detectTempo(mono, decoded.sampleRate, options);
  const report = tempoReport(result);
  return {
    outputs: [],
    report: { output: report.output, render: 'text' },
    stats: {
      ...report.stats,
      sampleRate: decoded.sampleRate,
      duration: `${((decoded.channels[0]?.length ?? 0) / decoded.sampleRate).toFixed(1)} s`,
    },
    notes: report.notes,
  };
}

/* -------------------------------------------------------------------------- */
/*  DOM wiring                                                                 */
/* -------------------------------------------------------------------------- */

/** Mount the BPM detector into a `[data-bpm-panel]` element. */
export function mountBpmDetectorPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'bpm-detector';

  const fileInput = root.querySelector<HTMLInputElement>('[data-bpm-file]')!;
  const micBtn = root.querySelector<HTMLButtonElement>('[data-bpm-mic]')!;
  const micStopBtn = root.querySelector<HTMLButtonElement>('[data-bpm-mic-stop]')!;
  const tapBtn = root.querySelector<HTMLButtonElement>('[data-bpm-tap]')!;
  const resetTapBtn = root.querySelector<HTMLButtonElement>('[data-bpm-tap-reset]')!;
  const status = root.querySelector<HTMLElement>('[data-bpm-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-bpm-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-bpm-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-bpm-report]')!;
  const notesEl = root.querySelector<HTMLElement>('[data-bpm-notes]')!;
  const optionsRoot = root.querySelector<HTMLElement>('[data-bpm-options]') ?? root;

  if (
    !fileInput ||
    !micBtn ||
    !micStopBtn ||
    !tapBtn ||
    !resetTapBtn ||
    !status ||
    !errorBox ||
    !resultWrap ||
    !reportEl ||
    !notesEl
  ) {
    return;
  }

  let micStream: MediaStream | null = null;
  let micRecorder: MediaRecorder | null = null;
  let taps: number[] = [];

  /** Read the panel's option fields into a plain object. */
  function readOptionValues(rootEl: ParentNode): Record<string, string | number | boolean> {
    const values: Record<string, string | number | boolean> = {};
    rootEl.querySelectorAll<HTMLElement>('[data-opt-key]').forEach((el) => {
      const key = el.dataset.optKey!;
      const type = el.dataset.optType;
      if (type === 'boolean') values[key] = (el as HTMLInputElement).checked;
      else values[key] = (el as HTMLInputElement | HTMLSelectElement).value;
    });
    return values;
  }

  function options(): TempoOptions {
    return readTempoOptions(readOptionValues(optionsRoot));
  }

  function setStatus(message: string): void {
    status.textContent = message;
  }

  function clearResult(): void {
    resultWrap.hidden = true;
    reportEl.replaceChildren();
    notesEl.replaceChildren();
    clearError(errorBox);
  }

  function renderTapResult(): void {
    const bpm = averageTapTempo(taps);
    setStatus(tapStatus(taps));
    if (!bpm) return;
    const report = tempoReport({ bpm, confidence: tapConfidence(taps), lag: 0 });
    resultWrap.hidden = false;
    renderTextResult(reportEl, { output: report.output, render: report.render });
    notesEl.replaceChildren();
    for (const note of report.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-xs text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.appendChild(li);
    }
    clearError(errorBox);
  }

  async function present(file: File, source: string): Promise<void> {
    clearResult();
    setStatus(`Analysing ${source}…`);
    try {
      const result = await runToolById<FileRunResult>(toolId, {
        files: [file],
        options: options(),
      });
      resultWrap.hidden = false;
      if (result.report) {
        renderTextResult(reportEl, {
          output: result.report.output,
          render: result.report.render,
          language: result.report.language,
        });
      }
      notesEl.replaceChildren();
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.className = 'text-xs text-[rgb(var(--text-muted))]';
        li.textContent = note;
        notesEl.appendChild(li);
      }
      clearError(errorBox);
      setStatus(`Detected from ${source}.`);
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'Could not detect a tempo.', e.hint);
      setStatus('Detection failed.');
    }
  }

  function stopMic(): void {
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
    if (micRecorder && micRecorder.state !== 'inactive') micRecorder.stop();
    micRecorder = null;
    micBtn.hidden = false;
    micStopBtn.hidden = true;
    micBtn.textContent = 'Use microphone';
  }

  async function startMic(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support microphone input.');
      }
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micBtn.hidden = true;
      micStopBtn.hidden = false;
      setStatus('Listening — tap with the space bar to set a tempo.');
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'Could not open the microphone.', e.hint);
    }
  }

  function stopRecording(): void {
    if (micRecorder && micRecorder.state !== 'inactive') micRecorder.stop();
    micRecorder = null;
    stopMic();
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    stopRecording();
    taps = [];
    void present(file, file.name);
  });

  micBtn.addEventListener('click', () => void startMic());

  micStopBtn.addEventListener('click', () => {
    stopRecording();
    setStatus('Microphone stopped.');
  });

  tapBtn.addEventListener('click', () => {
    taps = addTap(taps, performance.now());
    renderTapResult();
  });

  resetTapBtn.addEventListener('click', () => {
    taps = [];
    clearResult();
    setStatus('Tempo reset. Tap to the beat, or analyse a file or the mic.');
  });

  // Space bar taps while the panel is focused.
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.code !== 'Space') return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      ['input', 'textarea', 'select', 'button'].includes(target.tagName.toLowerCase())
    ) {
      return;
    }
    event.preventDefault();
    tapBtn.click();
  });

  window.addEventListener('beforeunload', stopRecording);

  clearResult();
  setStatus('Choose an audio file, or press “Use microphone” and tap along to the beat.');
}
