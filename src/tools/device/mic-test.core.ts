/**
 * Pure logic for the Microphone Test tool (device category).
 *
 * Everything here is DOM-free and worker-safe, so `run()` can be unit-tested
 * without a browser: AnalyserNode byte → dBFS conversion, peak/RMS maths,
 * loudness verdicts, the checks a recorded clip has to pass, and the session
 * summary report.
 *
 * The microphone, AudioContext, canvas and MediaRecorder live in
 * `src/components/panels/mic-test.ts`; this module only sees numbers and bytes.
 */

import type { OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { clamp, formatBytes, formatDuration, formatNumber } from '@/lib/format';

/** Default silence floor for the dB readouts and the meter scale. */
export const METER_FLOOR_DB = -80;

/** A peak at (or above) full scale — the signal is clipping. */
export const CLIP_PEAK = 1;

/** Refuse absurd recordings outright (256 MiB ≈ 4 h of Opus). */
export const MAX_RECORDING_BYTES = 256 * 1024 * 1024;

/** Shorter than this and there is nothing worth reporting. */
export const MIN_RECORDING_MS = 200;

/** FFT sizes an AnalyserNode accepts. */
export const FFT_SIZES = [1024, 2048, 4096, 8192] as const;

/** Below this linear RMS the input counts as silence. */
const SILENCE_RMS = 1e-5;

/** Characteristics of a recorded clip, as decoded by the panel. */
export interface MicMetrics {
  /** Clip length in milliseconds. */
  durationMs?: number;
  /** Sample rate in Hz. */
  sampleRate?: number;
  /** Channel count. */
  channels?: number;
  /** Loudest sample in the clip, 0..1+ (may exceed 1 when clipping). */
  peak?: number;
  /** Root-mean-square level of the clip, 0..1. */
  rms?: number;
  /** MediaRecorder MIME type, e.g. `audio/webm;codecs=opus`. */
  format?: string;
  /** Label of the input device, when the browser exposes one. */
  deviceLabel?: string;
}

/** Meter/recorder settings, resolved from the tool's options. */
export interface MicSettings {
  fftSize: number;
  smoothing: number;
  floorDb: number;
  maxSeconds: number;
}

/** One frame's worth of level information. */
export interface MeterReading {
  peak: number;
  rms: number;
  peakDb: number;
  rmsDb: number;
}

export type LevelTone = 'unknown' | 'silent' | 'quiet' | 'good' | 'loud' | 'clip';

export interface LevelVerdict {
  label: string;
  tone: LevelTone;
  advice: string;
}

/* -------------------------------------------------------------------------- */
/*  Analyser bytes → levels                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `AnalyserNode.getByteTimeDomainData` bytes (0..255, where 128 is silence) as
 * floats in −1..1. Missing values are treated as silence.
 */
export function analyserBytesToFloat(bytes: ArrayLike<number>): Float32Array {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = ((bytes[i] ?? 128) - 128) / 128;
  }
  return out;
}

/** Largest absolute sample. Non-finite samples are ignored. */
export function computePeak(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.abs(samples[i] ?? 0);
    if (value > peak) peak = value;
  }
  return peak;
}

/** Root-mean-square level of the samples (0 for an empty or silent buffer). */
export function computeRms(samples: ArrayLike<number>): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] ?? 0;
    if (!Number.isFinite(value)) continue;
    sum += value * value;
    count++;
  }
  if (count === 0) return 0;
  return Math.sqrt(sum / count);
}

/** Linear amplitude to dBFS (`-Infinity` for silence or a non-positive value). */
export function amplitudeToDb(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return -Infinity;
  return 20 * Math.log10(amplitude);
}

/** Build a reading from an already-measured peak/RMS pair. */
export function readingFromLevels(peak: number, rms: number): MeterReading {
  const p = Number.isFinite(peak) && peak > 0 ? peak : 0;
  const r = Number.isFinite(rms) && rms > 0 ? rms : 0;
  return { peak: p, rms: r, peakDb: amplitudeToDb(p), rmsDb: amplitudeToDb(r) };
}

/** Peak and RMS of a single frame of samples. */
export function readingOf(samples: ArrayLike<number>): MeterReading {
  return readingFromLevels(computePeak(samples), computeRms(samples));
}

/** Peak and RMS of one AnalyserNode byte frame. */
export function readingOfAnalyserBytes(bytes: ArrayLike<number>): MeterReading {
  return readingOf(analyserBytesToFloat(bytes));
}

/**
 * Peak and RMS across several channels. The overall RMS is the energy average,
 * so a mono file and a duplicated stereo file report the same level.
 */
export function readingOfChannels(channels: readonly ArrayLike<number>[]): MeterReading {
  let peak = 0;
  let energy = 0;
  let count = 0;
  for (const channel of channels) {
    peak = Math.max(peak, computePeak(channel));
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i] ?? 0;
      if (!Number.isFinite(value)) continue;
      energy += value * value;
      count++;
    }
  }
  const rms = count === 0 ? 0 : Math.sqrt(energy / count);
  return readingFromLevels(peak, rms);
}

/* -------------------------------------------------------------------------- */
/*  dB helpers and verdicts                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Where a dB value sits on a meter whose bottom is `floorDb` and whose top is
 * 0 dBFS: 0 at the floor, 1 at full scale. Silence maps to 0.
 */
export function dbToFraction(db: number, floorDb: number = METER_FLOOR_DB): number {
  const floor = Number.isFinite(floorDb) && floorDb < 0 ? floorDb : METER_FLOOR_DB;
  if (!Number.isFinite(db)) return 0;
  return clamp((db - floor) / -floor, 0, 1);
}

/** `-12.3 dB`, or `−∞ dB` for silence. */
export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return '−∞ dB';
  return `${db.toFixed(1)} dB`;
}

/** Turn a level into a short verdict plus one line of advice. */
export function levelVerdict(reading: MeterReading): LevelVerdict {
  const { peak, rms, peakDb, rmsDb } = reading;
  if (!Number.isFinite(peak) || !Number.isFinite(rms)) {
    return {
      label: 'Not measured',
      tone: 'unknown',
      advice: 'Enable the microphone and record a few seconds to get a level reading.',
    };
  }
  if (peak <= 0 && rms <= SILENCE_RMS) {
    return {
      label: 'Silent',
      tone: 'silent',
      advice:
        'No signal is reaching the analyser — check that the right input is selected and that it is not muted.',
    };
  }
  if (peak >= CLIP_PEAK) {
    return {
      label: 'Clipping',
      tone: 'clip',
      advice: `Peaks hit full scale (${formatDb(peakDb)}). Move away from the microphone or lower the input level, then try again.`,
    };
  }
  if (rmsDb < -40) {
    return {
      label: 'Very quiet',
      tone: 'quiet',
      advice: 'Barely any signal — speak closer to the microphone or raise the input level.',
    };
  }
  if (rmsDb < -24) {
    return {
      label: 'Quiet',
      tone: 'quiet',
      advice: 'The level is on the low side — move a little closer to the microphone.',
    };
  }
  if (rmsDb <= -6) {
    return {
      label: 'Good level',
      tone: 'good',
      advice: 'This is a healthy recording level: loud enough and safely below full scale.',
    };
  }
  return {
    label: 'Hot',
    tone: 'loud',
    advice: 'Very loud — lower the input level a little to leave headroom for peaks.',
  };
}

/* -------------------------------------------------------------------------- */
/*  Recording checks                                                          */
/* -------------------------------------------------------------------------- */

export interface RecordingInfo {
  /** Clip size in bytes. */
  size: number;
  /** Reported MIME type (may be empty when the browser does not say). */
  type: string;
  /** Clip length in milliseconds, when known. */
  durationMs?: number;
}

/** Throw a friendly `ToolError` unless the clip is something we can report on. */
export function validateRecording(info: RecordingInfo): void {
  if (!Number.isFinite(info.size) || info.size <= 0) {
    throw new ToolError(
      'The recording is empty.',
      'Nothing was captured — check that the right microphone is selected and that the meter moves while you speak, then record again.',
    );
  }
  if (info.size > MAX_RECORDING_BYTES) {
    throw new ToolError(
      'The recording is too large to analyse.',
      `Keep takes under ${formatBytes(MAX_RECORDING_BYTES)} — use a shorter recording limit.`,
    );
  }
  const type = info.type.trim();
  if (type && !/^audio\//i.test(type)) {
    throw new ToolError(
      'That file is not an audio recording.',
      'Record a take with this panel instead — the tool expects the audio it captured from your microphone.',
    );
  }
  if (typeof info.durationMs === 'number' && Number.isFinite(info.durationMs)) {
    if (info.durationMs < MIN_RECORDING_MS) {
      throw new ToolError(
        'The recording is too short to analyse.',
        `Record at least ${MIN_RECORDING_MS / 1000} s so there is some signal to measure.`,
      );
    }
  }
}

/** File extension for a recorded MIME type. */
export function recordingExtension(mimeType: string): string {
  const base = String(mimeType ?? '')
    .split(';')[0]!
    .trim()
    .toLowerCase();
  switch (base) {
    case 'audio/ogg':
    case 'application/ogg':
      return 'ogg';
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
    case 'audio/wave':
      return 'wav';
    case 'audio/flac':
    case 'audio/x-flac':
      return 'flac';
    case 'audio/aac':
      return 'aac';
    default:
      // MediaRecorder's default in Chromium, Firefox-without-Opus and friends.
      return 'webm';
  }
}

/** `mic-recording-20260124-153000.webm` — deterministic once the clock is passed in. */
export function recorderFilename(mimeType: string, at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `mic-recording-${stamp}.${recordingExtension(mimeType)}`;
}

/**
 * Pick the first MIME type the browser can record. `isSupported` is
 * `MediaRecorder.isTypeSupported`; an empty string means "let the browser
 * choose its default".
 */
export function pickRecorderMime(
  preferred: readonly string[],
  isSupported: (type: string) => boolean,
): string {
  for (const candidate of preferred) {
    try {
      if (isSupported(candidate)) return candidate;
    } catch {
      // A browser that throws on a MIME probe simply cannot record it.
    }
  }
  return '';
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                  */
/* -------------------------------------------------------------------------- */

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Resolve the meter/recorder settings from raw option values, clamping junk. */
export function meterSettings(options: OptionValues = {}): MicSettings {
  const fft = Math.round(toNumber(options.fftSize, 2048));
  return {
    fftSize: (FFT_SIZES as readonly number[]).includes(fft) ? fft : 2048,
    smoothing: clamp(toNumber(options.smoothing, 0.6), 0, 1),
    floorDb: clamp(toNumber(options.floorDb, METER_FLOOR_DB), -120, -20),
    maxSeconds: Math.round(clamp(toNumber(options.maxSeconds, 60), 1, 3600)),
  };
}

/* -------------------------------------------------------------------------- */
/*  Friendly errors                                                           */
/* -------------------------------------------------------------------------- */

/** Turn a `getUserMedia` / `MediaRecorder` failure into a user-facing error. */
export function describeMicError(err: unknown): ToolError {
  const e = err as { name?: string; message?: string } | undefined;
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new ToolError(
        'Microphone permission was denied.',
        'Allow microphone access for this site — open the padlock in the address bar, set Microphone to “Allow”, then press Enable microphone again.',
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new ToolError(
        'No microphone was found on this device.',
        'Connect a microphone (or a headset) and check that it is enabled in your system sound settings, then try again.',
      );
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new ToolError(
        'The microphone is already in use.',
        'Close other apps or tabs that are recording (calls, voice notes, other tabs), then press Enable microphone again.',
      );
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new ToolError(
        'The chosen microphone is no longer available.',
        'Pick another device from the list, or press Enable microphone again to use the default input.',
      );
    case 'SecurityError':
      return new ToolError(
        'Microphone access is blocked on this page.',
        'Browsers only allow microphones on secure pages — open this tool over https:// (or localhost), then try again.',
      );
    case 'NotSupportedError':
      return new ToolError(
        'This browser cannot record audio.',
        'MediaRecorder is unavailable — the level meter and waveform still work, and you can check the input in your system sound settings.',
      );
    case 'InvalidStateError':
      return new ToolError(
        'The recorder is busy.',
        'Stop the current recording, wait a moment, then record again.',
      );
    case 'TypeError':
      return new ToolError(
        'This browser cannot open the microphone.',
        'getUserMedia is unavailable here — try a current version of Chrome, Edge, Firefox or Safari on a secure page.',
      );
    default:
      return new ToolError(
        'The microphone could not be started.',
        'Reload the page and try again; if it keeps failing, close other tabs that use audio and check your system input device.',
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  Summary report                                                            */
/* -------------------------------------------------------------------------- */

export interface MicReportInput {
  filename: string;
  sizeBytes: number;
  type: string;
  /** Measurements decoded by the panel; absent when only the file is known. */
  metrics?: MicMetrics;
  settings: MicSettings;
}

export interface MicReport {
  headers: string[];
  rows: string[][];
  warnings: string[];
  verdict: LevelVerdict;
}

const NOT_MEASURED = 'not measured';

/**
 * Build the summary table shown after a recording: what was captured, how loud
 * it was and which settings produced it — plus any warnings worth acting on.
 */
export function buildMicReport(input: MicReportInput): MicReport {
  const m = input.metrics ?? {};
  const measured =
    typeof m.peak === 'number' &&
    typeof m.rms === 'number' &&
    Number.isFinite(m.peak) &&
    Number.isFinite(m.rms);
  const reading: MeterReading = measured
    ? readingFromLevels(m.peak!, m.rms!)
    : { peak: NaN, rms: NaN, peakDb: -Infinity, rmsDb: -Infinity };
  const verdict = levelVerdict(reading);

  const durationMs = Number.isFinite(m.durationMs) ? (m.durationMs as number) : undefined;
  const sampleRate = Number.isFinite(m.sampleRate) ? (m.sampleRate as number) : undefined;
  const channels = Number.isFinite(m.channels) ? (m.channels as number) : undefined;

  const rows: string[][] = [];
  rows.push(['File name', input.filename || 'recording']);
  if (m.deviceLabel) rows.push(['Input device', m.deviceLabel]);
  rows.push(['Format', input.type || m.format || 'unknown']);
  rows.push(['File size', formatBytes(input.sizeBytes)]);
  rows.push(['Duration', durationMs === undefined ? NOT_MEASURED : formatDuration(durationMs)]);
  rows.push([
    'Sample rate',
    sampleRate === undefined ? NOT_MEASURED : `${formatNumber(sampleRate)} Hz`,
  ]);
  rows.push(['Channels', channels === undefined ? NOT_MEASURED : String(channels)]);
  rows.push([
    'Peak level',
    measured ? `${formatDb(reading.peakDb)} (${reading.peak.toFixed(3)} full scale)` : NOT_MEASURED,
  ]);
  rows.push([
    'RMS level',
    measured ? `${formatDb(reading.rmsDb)} (${reading.rms.toFixed(3)} full scale)` : NOT_MEASURED,
  ]);
  rows.push(['Headroom to full scale', measured ? formatDb(-reading.peakDb) : NOT_MEASURED]);
  rows.push(['Level verdict', verdict.label]);
  rows.push(['FFT size', String(input.settings.fftSize)]);
  rows.push(['Meter floor', formatDb(input.settings.floorDb)]);
  rows.push(['Recording limit', `${input.settings.maxSeconds} s`]);

  const warnings: string[] = [];
  if (measured) {
    if (verdict.tone === 'clip') {
      warnings.push(
        'The recording clips — peaks reach full scale. Move back from the microphone or lower the input level and record again.',
      );
    } else if (verdict.tone === 'silent') {
      warnings.push(
        'The recording is silent — no signal reached the microphone. Check the selected input device and the system input level.',
      );
    } else if (verdict.tone === 'quiet') {
      warnings.push(
        'The recording is very quiet — move closer to the microphone or raise the input level.',
      );
    }
  }
  if (durationMs !== undefined && durationMs > input.settings.maxSeconds * 1000 + 500) {
    warnings.push(
      `The recording is longer than the ${input.settings.maxSeconds} s limit, so it was captured with a raised limit or truncated.`,
    );
  }

  return { headers: ['Property', 'Value'], rows, warnings, verdict };
}
