/**
 * The pitch tuner panel.
 *
 * The generic text workbench cannot express a live microphone readout — a
 * note name, a cents needle and a reference list — so this tool opts into a
 * panel via `meta.panel = 'tuner'`. Everything that is worth testing (the YIN
 * pitch detector, the equal-temperament note mapping, the cents math and the
 * silence/tolerance gates) lives here as pure functions; `mountTunerPanel` is
 * the only DOM-touching code. The tool's `run()` re-uses the same pure logic
 * so the report and the live needle always agree.
 */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import {
  clearError,
  readOptions,
  renderTextResult,
  showError,
} from '@/components/workbench/shared';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/** Semitone names with sharps; the `notation` option switches to flats. */
export const SEMITONE_SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const SEMITONE_FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** The A4 reference the tool is calibrated to (equal temperament). */
export const DEFAULT_A4 = 440;

/** Defaults for the YIN detector. */
export const DEFAULT_THRESHOLD = 0.12;
export const DEFAULT_MIN_FREQUENCY = 40;
export const DEFAULT_MAX_FREQUENCY = 4000;
export const DEFAULT_SILENCE_RMS = 0.004;

/** How far left/right the cents needle can travel (± cents). */
export const NEEDLE_RANGE_CENTS = 50;

/** How many consecutive confident readings prove a note before capture. */
export const HOLD_READINGS = 6;

/** How often the analyser is polled (ms). */
export const POLL_INTERVAL_MS = 50;

/* -------------------------------------------------------------------------- */
/*  Pure logic — pitch detection (YIN)                                         */
/* -------------------------------------------------------------------------- */

export interface YinOptions {
  /** Sample rate of the buffer, in Hz. */
  sampleRate: number;
  /** Absolute threshold for the cumulative mean normalised difference. */
  threshold?: number;
  /** Ignore periods below this frequency (Hz). */
  minFrequency?: number;
  /** Ignore periods above this frequency (Hz). */
  maxFrequency?: number;
  /** Silence gate: RMS below this value reports no pitch. */
  silenceRms?: number;
}

export interface PitchResult {
  /** Detected frequency in Hz, or `null` when no confident pitch was found. */
  frequency: number | null;
  /** The YIN period in samples (before interpolation), or 0. */
  period: number;
  /** Best (lowest) cumulative mean normalised difference — 0 is a perfect match. */
  confidence: number;
  /** RMS amplitude of the window. */
  rms: number;
  /** Why no pitch was reported, when `frequency` is null. */
  reason?: 'silent' | 'no-pitch' | 'out-of-range';
}

/**
 * YIN pitch detection (de Cheveigné & Kawahara, 2002) over a mono float32
 * time-domain buffer.
 *
 * 1. Difference function  d(τ) = Σ (x[j] − x[j+τ])²
 * 2. Cumulative mean normalised difference  d′(τ)
 * 3. Absolute threshold: the first τ whose d′(τ) dips below `threshold`
 * 4. Local minimum + parabolic interpolation around that τ
 * 5. f0 = sampleRate / τ
 *
 * Pure function — no Web Audio, no DOM — so the panel and the unit tests feed
 * it the same synthetic sine waves.
 */
export function yinPitchDetect(samples: Float32Array, options: YinOptions): PitchResult {
  const sampleRate = options.sampleRate;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const minFrequency = options.minFrequency ?? DEFAULT_MIN_FREQUENCY;
  const maxFrequency = options.maxFrequency ?? DEFAULT_MAX_FREQUENCY;
  const silenceRms = options.silenceRms ?? DEFAULT_SILENCE_RMS;

  const n = samples.length;

  // Silence gate: a quiet or flat window carries no pitch.
  const rms = computeRms(samples);
  if (!Number.isFinite(rms) || rms < silenceRms) {
    return { frequency: null, period: 0, confidence: 1, rms, reason: 'silent' };
  }

  // The YIN difference function needs W + τmax samples; halve the window so
  // every τ up to W is well supported.
  const maxPeriod = Math.floor(n / 2);
  const minPeriod = Math.max(1, Math.floor(sampleRate / maxFrequency));
  const periodCap = Math.min(maxPeriod, Math.floor(sampleRate / minFrequency));
  if (periodCap < minPeriod) {
    return { frequency: null, period: 0, confidence: 1, rms, reason: 'out-of-range' };
  }

  // Step 1 + 2 — difference function, then the cumulative mean normalisation.
  const diff = new Float32Array(maxPeriod + 1);
  for (let tau = 0; tau <= maxPeriod; tau++) {
    let sum = 0;
    const limit = n - maxPeriod;
    for (let j = 0; j < limit; j++) {
      const delta = samples[j]! - samples[j + tau]!;
      sum += delta * delta;
    }
    diff[tau] = sum;
  }
  diff[0] = 1; // d′(0) is defined as 1 so it can never win the threshold race.

  const cumMean = new Float32Array(maxPeriod + 1);
  let running = 0;
  cumMean[0] = 1;
  for (let tau = 1; tau <= maxPeriod; tau++) {
    running += diff[tau]!;
    cumMean[tau] = running > 0 ? (diff[tau]! * tau) / running : 1;
  }

  // Step 3 — the first dip below the threshold (starting just above the
  // smallest allowed period, so octave sub-harmonics of a strong fundamental
  // cannot win).
  let tauEstimate = -1;
  for (let tau = minPeriod; tau <= periodCap; tau++) {
    if (cumMean[tau]! < threshold) {
      while (tau + 1 <= periodCap && cumMean[tau + 1]! < cumMean[tau]!) tau++;
      tauEstimate = tau;
      break;
    }
  }

  // No dip: fall back to the global minimum, but only trust it when it is
  // clearly better than the threshold.
  if (tauEstimate === -1) {
    let bestTau = minPeriod;
    let bestValue = 1;
    for (let tau = minPeriod; tau <= periodCap; tau++) {
      if (cumMean[tau]! < bestValue) {
        bestValue = cumMean[tau]!;
        bestTau = tau;
      }
    }
    if (bestValue > threshold) {
      return { frequency: null, period: 0, confidence: bestValue, rms, reason: 'no-pitch' };
    }
    tauEstimate = bestTau;
  }

  // Step 4 — parabolic interpolation around the local minimum.
  const x0 = Math.max(tauEstimate - 1, minPeriod);
  const x1 = tauEstimate;
  const x2 = Math.min(tauEstimate + 1, periodCap);
  const y0 = cumMean[x0]!;
  const y1 = cumMean[x1]!;
  const y2 = cumMean[x2]!;
  const denom = 2 * (2 * y1 - y2 - y0);
  let betterTau = tauEstimate;
  if (denom !== 0) {
    betterTau = tauEstimate + ((y2 - y0) / denom) * 0.5;
  }

  const frequency = sampleRate / betterTau;
  return { frequency, period: betterTau, confidence: y1, rms };
}

/** The RMS of a float32 window, in linear amplitude. */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/* -------------------------------------------------------------------------- */
/*  Pure logic — note mapping, cents, gates                                    */
/* -------------------------------------------------------------------------- */

export interface TunerNote {
  /** The nearest semitone name, e.g. `A`. */
  name: string;
  /** The octave of the nearest note, e.g. 4. */
  octave: number;
  /** MIDI number of the nearest note (69 = A4). */
  midi: number;
  /** Index of the semitone within the octave (0 = C). */
  semitone: number;
  /** The reference frequency of the nearest note, in Hz. */
  reference: number;
  /** Deviation of the detected frequency from the reference, in cents. */
  cents: number;
}

/**
 * Frequency → nearest note under equal temperament with an adjustable A4.
 * `cents` is positive when the input is sharp of the reference, negative when
 * flat. Returns `null` for non-finite frequencies.
 */
export function frequencyToNote(frequency: number, a4 = DEFAULT_A4): TunerNote | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const midiFractional = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(midiFractional);
  const semitone = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const reference = midiToFrequency(midi, a4);
  const cents = 1200 * Math.log2(frequency / reference);
  return { name: SEMITONE_SHARPS[semitone]!, octave, midi, semitone, reference, cents };
}

/** MIDI note number → frequency under equal temperament with the given A4. */
export function midiToFrequency(midi: number, a4 = DEFAULT_A4): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** The semitone name of a MIDI number, honouring the flat/sharp notation. */
export function semitoneName(midi: number, notation: 'sharps' | 'flats' = 'sharps'): string {
  const semitone = ((Math.round(midi) % 12) + 12) % 12;
  return (notation === 'flats' ? SEMITONE_FLATS : SEMITONE_SHARPS)[semitone]!;
}

/** Format a frequency for display, e.g. `440.0 Hz`. */
export function formatFrequency(hertz: number): string {
  if (!Number.isFinite(hertz) || hertz <= 0) return '—';
  return hertz >= 100 ? `${hertz.toFixed(1)} Hz` : `${hertz.toFixed(2)} Hz`;
}

/** Format a cents deviation, e.g. `−3.2 ¢` or `+0.0 ¢`. */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  const value = Math.abs(cents) < 0.05 ? 0 : cents;
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)} ¢`;
}

/** A plain word for a deviation, so the needle never relies on colour alone. */
export function centsWord(cents: number, tolerance: number): string {
  if (!Number.isFinite(cents)) return 'Listening…';
  const abs = Math.abs(cents);
  if (abs <= tolerance) return 'In tune';
  return cents < 0 ? 'Flat' : 'Sharp';
}

/** Needle position 0..1 across the ±`range` cents scale, clamped. */
export function needlePosition(cents: number, range = NEEDLE_RANGE_CENTS): number {
  if (!Number.isFinite(cents)) return 0.5;
  return Math.min(1, Math.max(0, 0.5 + cents / (2 * range)));
}

/**
 * Run the full detection pipeline: YIN → nearest note → gates. Returns
 * `null` when the window is silent or carries no confident pitch.
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  options: {
    a4?: number;
    threshold?: number;
    minFrequency?: number;
    maxFrequency?: number;
    silenceRms?: number;
  } = {},
): { pitch: PitchResult; note: TunerNote | null } {
  const pitch = yinPitchDetect(samples, { sampleRate, ...options });
  if (pitch.frequency === null) return { pitch, note: null };
  const note = frequencyToNote(pitch.frequency, options.a4 ?? DEFAULT_A4);
  return { pitch, note };
}

/* -------------------------------------------------------------------------- */
/*  Pure logic — the session report shared with the tool's run()               */
/* -------------------------------------------------------------------------- */

export interface TunerSnapshot {
  /** Detected frequencies captured during the session, in Hz. */
  readings: number[];
  /** Sample rate the live detector ran at (used for window descriptions). */
  sampleRate?: number;
  /** RMS of each captured reading, when known. */
  rms?: number[];
}

export interface TunerSettings {
  a4: number;
  threshold: number;
  minFrequency: number;
  maxFrequency: number;
  silenceRms: number;
  tolerance: number;
  notation: 'sharps' | 'flats';
}

/** Normalise the option bag into detector settings, with the declared defaults. */
export function tunerSettings(o: OptionValues): TunerSettings {
  const a4 = Number(o.a4);
  const threshold = Number(o.threshold);
  const minFrequency = Number(o.minFrequency);
  const maxFrequency = Number(o.maxFrequency);
  const silenceRms = Number(o.silenceRms);
  const tolerance = Number(o.toleranceCents);
  return {
    a4: Number.isFinite(a4) && a4 > 0 ? a4 : DEFAULT_A4,
    threshold:
      Number.isFinite(threshold) && threshold > 0 && threshold < 1 ? threshold : DEFAULT_THRESHOLD,
    minFrequency:
      Number.isFinite(minFrequency) && minFrequency > 0 ? minFrequency : DEFAULT_MIN_FREQUENCY,
    maxFrequency:
      Number.isFinite(maxFrequency) && maxFrequency > 0 ? maxFrequency : DEFAULT_MAX_FREQUENCY,
    silenceRms: Number.isFinite(silenceRms) && silenceRms >= 0 ? silenceRms : DEFAULT_SILENCE_RMS,
    tolerance: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 5,
    notation: o.notation === 'flats' ? 'flats' : 'sharps',
  };
}

/**
 * Turn a session snapshot (or a raw sample list) into a text report the tool
 * page can render. This is what `tuner.tool.ts` calls from its `run()`.
 */
export function runTuner(text: string, options: OptionValues): TextRunResult {
  const settings = tunerSettings(options);
  const snapshot = parseTunerInput(text);
  const readings = snapshot.readings.filter((f) => Number.isFinite(f) && f > 0);

  if (!readings.length) {
    throw new ToolError(
      'No pitch was detected in that input.',
      'Type a list of frequencies, or use the microphone to capture a session.',
    );
  }

  const rows: string[][] = [];
  const perNote = new Map<number, number[]>();
  for (const f of readings) {
    const note = frequencyToNote(f, settings.a4);
    if (!note) continue;
    const list = perNote.get(note.midi) ?? [];
    list.push(f);
    perNote.set(note.midi, list);
  }
  if (!perNote.size) {
    throw new ToolError(
      'No pitch was detected in that input.',
      'The frequencies must be positive numbers.',
    );
  }

  const sortedMidis = [...perNote.keys()].sort((a, b) => a - b);
  for (const midi of sortedMidis) {
    const freqs = perNote.get(midi)!;
    const note = frequencyToNote(freqs[0]!, settings.a4)!;
    const avg = freqs.reduce((sum, f) => sum + f, 0) / freqs.length;
    const cents = 1200 * Math.log2(avg / note.reference);
    const inTune = freqs.filter((f) => {
      const c = 1200 * Math.log2(f / note.reference);
      return Math.abs(c) <= settings.tolerance;
    }).length;
    rows.push([
      `${semitoneName(note.midi, settings.notation)}${note.octave}`,
      formatFrequency(note.reference),
      formatFrequency(avg),
      formatCents(cents),
      `${inTune}/${freqs.length}`,
    ]);
  }

  const allCents = readings.map((f) => {
    const note = frequencyToNote(f, settings.a4);
    return note ? Math.abs(note.cents) : Number.NaN;
  });
  const inTuneCount = allCents.filter(
    (c) => Number.isFinite(c) && Math.abs(c) <= settings.tolerance,
  ).length;
  const stats: Record<string, string | number> = {
    'Notes heard': rows.length,
    Readings: readings.length,
    'In tune': `${inTuneCount} of ${readings.length}`,
    'Within ±': `±${settings.tolerance} ¢`,
    Calibration: `A4 = ${formatFrequency(settings.a4)}`,
  };

  const notes: string[] = [];
  const worst = rows
    .map((row) => ({ note: row[0]!, cents: parseFloat(row[3]!.replace(/[+−¢\s]/g, '')) }))
    .filter((r) => Number.isFinite(r.cents));
  if (worst.length) {
    const max = worst.reduce((a, b) => (Math.abs(b.cents) > Math.abs(a.cents) ? b : a));
    if (Math.abs(max.cents) > settings.tolerance) {
      notes.push(`${max.note} was ${formatCents(max.cents)} off on average — retune it.`);
    } else {
      notes.push(`Every note heard sat within ±${settings.tolerance} ¢ of its reference.`);
    }
  }

  return {
    output: JSON.stringify({
      headers: ['Note', 'Reference', 'Average', 'Deviation', 'In tune'],
      rows,
    }),
    render: 'table',
    stats,
    notes,
  };
}

/** Parse the tool's text input: a session snapshot JSON or a plain number list. */
export function parseTunerInput(text: string): TunerSnapshot {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError(
      'No readings were provided.',
      'Type a list of frequencies or capture a mic session.',
    );
  }
  if (raw.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ToolError(
        'That is not a valid tuner snapshot.',
        'It should be JSON like {"readings": [440, 441]}',
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ToolError(
        'That is not a valid tuner snapshot.',
        'It should be JSON like {"readings": [440, 441]}',
      );
    }
    const obj = parsed as Partial<TunerSnapshot>;
    const readings = Array.isArray(obj.readings)
      ? obj.readings.filter((f) => typeof f === 'number')
      : [];
    if (obj.readings !== undefined && !readings.length) {
      throw new ToolError(
        'That snapshot holds no readings.',
        'Add at least one frequency to "readings".',
      );
    }
    return {
      readings,
      sampleRate: typeof obj.sampleRate === 'number' ? obj.sampleRate : undefined,
      rms: Array.isArray(obj.rms) ? obj.rms.filter((v) => typeof v === 'number') : undefined,
    };
  }
  // Plain list: numbers separated by whitespace, commas or semicolons.
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const readings: number[] = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new ToolError(
        'That is not a list of frequencies.',
        'Use numbers like 440 441.2 439.8, or a JSON snapshot.',
      );
    }
    // A frequency is a physical pitch: zero and negative values are not
    // readings a tuner can name, so they are refused rather than dropped.
    if (value <= 0) {
      throw new ToolError(
        'Frequencies must be positive.',
        `“${token}” is not a frequency a tuner can measure — use values above 0 Hz.`,
      );
    }
    readings.push(value);
  }
  return { readings };
}

/* -------------------------------------------------------------------------- */
/*  Panel wiring (browser only)                                                */
/* -------------------------------------------------------------------------- */

/** The `AudioContext` constructor, including the old WebKit prefix. */
function audioContextConstructor(): typeof AudioContext | undefined {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext;
}

/** Mount the tuner UI into a `[data-tuner-panel]` element. */
export function mountTunerPanel(root: HTMLElement): void {
  const startBtn = root.querySelector<HTMLButtonElement>('[data-tuner-start]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-tuner-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-tuner-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-tuner-error]')!;
  const stage = root.querySelector<HTMLElement>('[data-tuner-stage]')!;
  const noteEl = root.querySelector<HTMLElement>('[data-tuner-note]')!;
  const freqEl = root.querySelector<HTMLElement>('[data-tuner-freq]')!;
  const centsEl = root.querySelector<HTMLElement>('[data-tuner-cents]')!;
  const verdictEl = root.querySelector<HTMLElement>('[data-tuner-verdict]')!;
  const needle = root.querySelector<HTMLElement>('[data-tuner-needle]')!;
  const scaleEl = root.querySelector<HTMLElement>('[data-tuner-scale]')!;
  const liveEl = root.querySelector<HTMLElement>('[data-tuner-live]')!;
  const refEl = root.querySelector<HTMLElement>('[data-tuner-ref]')!;
  const optionsRoot = root.querySelector<HTMLElement>('[data-tuner-options]') ?? root;
  const captureBtn = root.querySelector<HTMLButtonElement>('[data-tuner-capture]')!;
  const reportBtn = root.querySelector<HTMLButtonElement>('[data-tuner-report]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-tuner-clear]')!;
  const sessionEl = root.querySelector<HTMLElement>('[data-tuner-session]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-tuner-report-host]')!;

  if (
    !startBtn ||
    !stopBtn ||
    !statusEl ||
    !errorBox ||
    !stage ||
    !noteEl ||
    !freqEl ||
    !centsEl ||
    !verdictEl ||
    !needle ||
    !scaleEl ||
    !liveEl ||
    !refEl ||
    !captureBtn ||
    !reportBtn ||
    !clearBtn ||
    !sessionEl ||
    !resultWrap ||
    !reportEl
  ) {
    return;
  }

  const abort = new AbortController();
  const signal = abort.signal;

  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let samples = new Float32Array(0);
  let intervalId: number | null = null;
  let destroyed = false;
  let lastNote = '';
  let holdCount = 0;
  /** The most recent detection, kept for the capture button. */
  let currentPitch: PitchResult | null = null;
  let currentNote: TunerNote | null = null;
  /** Frequencies captured into the session report. */
  let sessionReadings: number[] = [];
  let lastAnnouncedAt = 0;
  let lastAnnouncedNote = '';

  /** The options as the tool sees them, with the declared defaults applied. */
  function currentSettings(): TunerSettings {
    const values = readOptions(optionsRoot);
    return tunerSettings(values);
  }

  function announce(message: string): void {
    statusEl.textContent = message;
  }

  /** Announce the note politely — throttled, so a screen reader is not flooded. */
  function announceNote(noteName: string, cents: number, now: number): void {
    if (now - lastAnnouncedAt < 700) return;
    if (lastAnnouncedNote === noteName) return;
    lastAnnouncedAt = now;
    lastAnnouncedNote = noteName;
    liveEl.textContent = `${noteName} — ${formatCents(cents)}.`;
  }

  /** Draw the cents scale marks onto the needle track. */
  function drawScale(): void {
    scaleEl.replaceChildren();
    for (let c = -NEEDLE_RANGE_CENTS; c <= NEEDLE_RANGE_CENTS; c += 10) {
      const mark = document.createElement('span');
      mark.className = 'flex-1 text-center text-[10px] leading-none text-[rgb(var(--text-muted))]';
      mark.textContent = c === 0 ? '0' : c > 0 ? `+${c}` : `${c}`;
      scaleEl.appendChild(mark);
    }
  }

  /** Update the needle, readout and reference line for one detection. */
  function renderReading(
    pitch: PitchResult,
    note: TunerNote | null,
    settings: TunerSettings,
  ): void {
    if (!note || pitch.frequency === null) {
      noteEl.textContent = '·';
      freqEl.textContent = '—';
      centsEl.textContent = '—';
      verdictEl.textContent = 'Listening…';
      needle.style.left = '50%';
      needle.setAttribute('aria-valuenow', '0');
      needle.setAttribute('aria-valuetext', 'No pitch');
      refEl.textContent = 'Waiting for a sustained note';
      return;
    }
    const noteName = `${semitoneName(note.midi, settings.notation)}${note.octave}`;
    const cents = note.cents;
    noteEl.textContent = noteName;
    freqEl.textContent = formatFrequency(pitch.frequency);
    centsEl.textContent = formatCents(cents);
    verdictEl.textContent = centsWord(cents, settings.tolerance);
    const pos = needlePosition(cents);
    needle.style.left = `${(pos * 100).toFixed(2)}%`;
    needle.setAttribute('aria-valuenow', cents.toFixed(1));
    needle.setAttribute(
      'aria-valuetext',
      `${noteName} ${centsWord(cents, settings.tolerance)} — ${formatCents(cents)}`,
    );
    refEl.textContent = `${semitoneName(note.midi, settings.notation)}${note.octave} = ${formatFrequency(note.reference)}`;
    announceNote(noteName, cents, performance.now());
  }

  /** Poll the analyser: detect, draw, and hold a stable note for capture. */
  function tick(): void {
    if (destroyed || !analyser || samples.length === 0) return;
    analyser.getFloatTimeDomainData(samples);
    const settings = currentSettings();
    const { pitch, note } = detectPitch(samples, audioCtx?.sampleRate ?? 48000, settings);
    currentPitch = pitch;
    currentNote = note;
    renderReading(pitch, note, settings);

    if (note && pitch.frequency !== null) {
      const name = `${semitoneName(note.midi, settings.notation)}${note.octave}`;
      if (name === lastNote) {
        holdCount++;
      } else {
        holdCount = 1;
        lastNote = name;
      }
      if (holdCount >= HOLD_READINGS) {
        captureBtn.disabled = false;
        captureBtn.dataset.ready = 'true';
      }
    } else {
      holdCount = 0;
      lastNote = '';
      captureBtn.disabled = true;
      delete captureBtn.dataset.ready;
    }
  }

  function startLoop(): void {
    stopLoop();
    intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
  }

  function stopLoop(): void {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  /** Render the captured session through the tool's own run(). */
  async function renderReport(): Promise<void> {
    if (!sessionReadings.length) return;
    clearError(errorBox);
    reportBtn.disabled = true;
    const options = readOptions(optionsRoot);
    const snapshot: TunerSnapshot = {
      readings: sessionReadings,
      sampleRate: audioCtx?.sampleRate ?? undefined,
    };
    try {
      const result = await runToolById<TextRunResult>('tuner', {
        text: JSON.stringify(snapshot),
        options,
      });
      resultWrap.hidden = false;
      renderTextResult(reportEl, result);
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(errorBox, err.message || 'The session could not be reported.', err.hint);
    } finally {
      reportBtn.disabled = false;
    }
  }

  async function start(): Promise<void> {
    if (stream) return;
    clearError(errorBox);

    if (
      !window.isSecureContext ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      showError(
        errorBox,
        'The microphone is not available here.',
        'The tuner needs getUserMedia — try a recent Chrome, Edge, Firefox or Safari on HTTPS or localhost.',
      );
      return;
    }

    startBtn.disabled = true;
    announce('Requesting microphone permission…');

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showError(
        errorBox,
        'The microphone could not be opened.',
        'Check the permission prompt and your operating system’s privacy settings, then press Start again.',
      );
      startBtn.disabled = false;
      return;
    }

    const AudioContextCtor = audioContextConstructor();
    if (!AudioContextCtor) {
      showError(
        errorBox,
        'This browser has no Web Audio support.',
        'The tuner needs the Web Audio API — try a recent version of Chrome, Edge, Firefox or Safari.',
      );
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      startBtn.disabled = false;
      return;
    }

    try {
      audioCtx = new AudioContextCtor();
      await audioCtx.resume().catch(() => undefined);
      sourceNode = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      sourceNode.connect(analyser);
      // Keep the graph pulled by the audio thread, but mute the sink so the
      // microphone never reaches the speakers.
      const sink = audioCtx.createGain();
      sink.gain.value = 0;
      analyser.connect(sink);
      sink.connect(audioCtx.destination);
      samples = new Float32Array(analyser.fftSize);
    } catch {
      showError(
        errorBox,
        'The audio engine could not be started.',
        'Reload the page and press “Start microphone” again.',
      );
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      audioCtx = null;
      analyser = null;
      sourceNode = null;
      startBtn.disabled = false;
      return;
    }

    lastNote = '';
    holdCount = 0;
    sessionReadings = [];
    sessionEl.textContent = 'No readings yet.';
    resultWrap.hidden = true;
    reportEl.replaceChildren();
    drawScale();
    stage.hidden = false;
    startBtn.hidden = true;
    stopBtn.hidden = false;
    announce('Microphone on — play or sing a single note.');
    startLoop();
  }

  function stopMicrophone(message = 'Microphone off.'): void {
    stopLoop();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    sourceNode?.disconnect();
    sourceNode = null;
    analyser?.disconnect();
    analyser = null;
    void audioCtx?.close().catch(() => undefined);
    audioCtx = null;
    samples = new Float32Array(0);
    stage.hidden = true;
    startBtn.hidden = false;
    startBtn.disabled = false;
    stopBtn.hidden = true;
    captureBtn.disabled = true;
    delete captureBtn.dataset.ready;
    announce(message);
  }

  startBtn.addEventListener('click', () => void start(), { signal });
  stopBtn.addEventListener('click', () => stopMicrophone(), { signal });

  captureBtn.addEventListener(
    'click',
    () => {
      if (!currentPitch || !currentNote || currentPitch.frequency === null) return;
      sessionReadings.push(currentPitch.frequency);
      sessionEl.textContent = `${sessionReadings.length} reading${sessionReadings.length === 1 ? '' : 's'} captured`;
      captureBtn.disabled = true;
      delete captureBtn.dataset.ready;
      reportBtn.disabled = false;
    },
    { signal },
  );

  reportBtn.addEventListener('click', () => void renderReport(), { signal });

  clearBtn.addEventListener(
    'click',
    () => {
      sessionReadings = [];
      sessionEl.textContent = 'No readings yet.';
      reportBtn.disabled = true;
      resultWrap.hidden = true;
      reportEl.replaceChildren();
      clearError(errorBox);
    },
    { signal },
  );

  // Keep the needle current when options (calibration, notation) change.
  optionsRoot.addEventListener(
    'change',
    () => {
      if (analyser) drawScale();
    },
    { signal },
  );

  /** Release everything: the loop, the stream and the context. */
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    sourceNode?.disconnect();
    sourceNode = null;
    analyser?.disconnect();
    analyser = null;
    void audioCtx?.close().catch(() => undefined);
    audioCtx = null;
    samples = new Float32Array(0);
    abort.abort();
  }

  // Never leave a microphone — or a running interval — behind.
  window.addEventListener('pagehide', () => destroy(), { signal });
  window.addEventListener('beforeunload', () => destroy(), { signal });
  document.addEventListener('astro:before-swap', () => destroy(), { signal });

  // If the panel is removed from the document, tear everything down: a stray
  // interval would keep the microphone open forever.
  const parent = root.parentElement;
  if (parent && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (!root.isConnected) {
        observer.disconnect();
        destroy();
      }
    });
    observer.observe(parent, { childList: true });
    signal.addEventListener('abort', () => observer.disconnect());
  }
}
