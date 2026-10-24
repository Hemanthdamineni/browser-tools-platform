/**
 * Pure helpers for the microphone test tool.
 *
 * Nothing in this module touches the DOM, the network or a device: every
 * export is a plain computation over numbers, arrays and strings, so the
 * level maths can be unit-tested in Node/jsdom. The browser-only parts
 * (`getUserMedia`, the Web Audio graph, the canvas and `MediaRecorder`) live
 * in `src/components/panels/mic-test-panel.ts`.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Levels                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The dBFS value used for digital silence.
 *
 * A true −∞ would poison every average with `NaN`, so the whole tool floors
 * silence at this value instead and never reports `NaN` or `-Infinity`.
 */
export const SILENCE_DB = -120;

/** The default bottom of the level meter (−60 dBFS … 0 dBFS). */
export const METER_FLOOR_DB = -60;

/** The top of the level meter: 0 dBFS is full scale. */
export const METER_CEILING_DB = 0;

/** How fast the peak-hold marker falls back, in dB per second. */
export const PEAK_HOLD_FALL_DB_PER_SECOND = 12;

/** A peak below this is treated as "the browser gave us a silent track". */
export const SILENT_PEAK_DB = -90;

/**
 * Convert a linear amplitude (0…1) to dBFS.
 *
 * The result is always finite and never above 0 dBFS: anything louder than
 * full scale is clipping, not "louder".
 */
export function linearToDb(amplitude: number): number {
  const a = Math.abs(Number(amplitude));
  if (!Number.isFinite(a) || a === 0) return SILENCE_DB;
  const db = 20 * Math.log10(a);
  if (!Number.isFinite(db)) return SILENCE_DB;
  return Math.min(METER_CEILING_DB, Math.max(SILENCE_DB, db));
}

/** The largest absolute sample value in a buffer (0 when there is none). */
export function computePeak(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = Number(samples[i]);
    if (!Number.isFinite(s)) continue;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  return peak;
}

/**
 * The root-mean-square of a buffer — the accurate "loudness" of a frame.
 *
 * `getFloatTimeDomainData` hands over real samples, so this is a true RMS
 * and not the coarse byte-domain estimate.
 */
export function computeRms(samples: ArrayLike<number>): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = Number(samples[i]);
    if (!Number.isFinite(s)) continue;
    sum += s * s;
    count++;
  }
  if (count === 0) return 0;
  return Math.sqrt(sum / count);
}

/** The RMS of a buffer, in dBFS. */
export function computeRmsDb(samples: ArrayLike<number>): number {
  return linearToDb(computeRms(samples));
}

/** The peak of a buffer, in dBFS. */
export function computePeakDb(samples: ArrayLike<number>): number {
  return linearToDb(computePeak(samples));
}

/** Format a dBFS value for humans. Never returns `NaN`. */
export function formatDb(db: number): string {
  if (typeof db !== 'number' || Number.isNaN(db)) return '—';
  if (db === Number.NEGATIVE_INFINITY) return '−∞ dBFS';
  if (!Number.isFinite(db)) return '—';
  const rounded = Math.round(db * 10) / 10;
  return `${(Object.is(rounded, -0) ? 0 : rounded).toFixed(1)} dBFS`;
}

/** A dBFS value as a percentage of full scale (0 dBFS = 100 %). */
export function dbToFullScalePercent(db: number): number {
  if (!Number.isFinite(db) || db <= SILENCE_DB) return 0;
  const percent = 100 * Math.pow(10, db / 20);
  if (!Number.isFinite(percent)) return 100;
  return Math.min(100, Math.max(0, percent));
}

/**
 * Where a dBFS value sits on the meter, as a 0…1 fraction.
 *
 * The scale is linear in decibels, so a bar at 50 % really is half way
 * between the floor and full scale.
 */
export function dbToMeterScale(
  db: number,
  floorDb: number = METER_FLOOR_DB,
  ceilingDb: number = METER_CEILING_DB,
): number {
  if (!Number.isFinite(db)) return 0;
  const span = ceilingDb - floorDb;
  if (!(span > 0)) return 0;
  const t = (db - floorDb) / span;
  return Math.min(1, Math.max(0, t));
}

/**
 * The peak-hold marker after `deltaMs` of quiet.
 *
 * The marker holds the loudest level seen and falls back slowly, so a short
 * spike stays visible for a moment instead of disappearing.
 */
export function decayPeakHold(
  current: number,
  deltaMs: number,
  fallDbPerSecond: number = PEAK_HOLD_FALL_DB_PER_SECOND,
): number {
  if (!Number.isFinite(current)) return SILENCE_DB;
  const dt = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  const fall = (Math.max(0, fallDbPerSecond) * dt) / 1000;
  return Math.max(SILENCE_DB, current - fall);
}

/* -------------------------------------------------------------------------- */
/*  Level summaries                                                            */
/* -------------------------------------------------------------------------- */

/** One analysis window: the linear RMS and peak of a block of samples. */
export interface LevelFrame {
  /** Linear RMS of the window (0 … 1). */
  rms: number;
  /** Linear peak of the window (0 … 1). */
  peak: number;
}

/** The summary of a whole recording. */
export interface LevelSummary {
  /** How many windows were analysed. */
  frames: number;
  /** The loudest linear peak seen. */
  peak: number;
  /** The loudest level, in dBFS. */
  peakDb: number;
  /** The energy-averaged RMS, linear. */
  rms: number;
  /** The energy-averaged RMS, in dBFS. */
  rmsDb: number;
  /** The mean of the per-window dB readings — what a meter averages over time. */
  averageDb: number;
  /** The loudest single window, in dBFS. */
  loudestDb: number;
  /** The quietest single window, in dBFS. */
  quietestDb: number;
  /** Whether any window reached full scale. */
  clipped: boolean;
}

/**
 * Summarise a series of level windows.
 *
 * The overall RMS is the energy average of the per-window RMS values (the
 * correct way to combine equal-length windows), while `averageDb` is the
 * plain mean of the per-window dB readings.
 */
export function summariseLevels(frames: readonly LevelFrame[]): LevelSummary {
  if (!frames.length) {
    return {
      frames: 0,
      peak: 0,
      peakDb: SILENCE_DB,
      rms: 0,
      rmsDb: SILENCE_DB,
      averageDb: SILENCE_DB,
      loudestDb: SILENCE_DB,
      quietestDb: SILENCE_DB,
      clipped: false,
    };
  }

  let peak = 0;
  let power = 0;
  let dbSum = 0;
  let loudest = Number.NEGATIVE_INFINITY;
  let quietest = Number.POSITIVE_INFINITY;
  let clipped = false;

  for (const frame of frames) {
    const rms = Number.isFinite(frame?.rms) ? Math.max(0, frame.rms) : 0;
    const framePeak = Number.isFinite(frame?.peak) ? Math.max(0, frame.peak) : 0;
    if (framePeak > peak) peak = framePeak;
    if (framePeak >= 1) clipped = true;
    power += rms * rms;
    const db = linearToDb(rms);
    dbSum += db;
    if (db > loudest) loudest = db;
    if (db < quietest) quietest = db;
  }

  const rms = Math.sqrt(power / frames.length);
  return {
    frames: frames.length,
    peak,
    peakDb: linearToDb(peak),
    rms,
    rmsDb: linearToDb(rms),
    averageDb: dbSum / frames.length,
    loudestDb: loudest === Number.NEGATIVE_INFINITY ? SILENCE_DB : loudest,
    quietestDb: quietest === Number.POSITIVE_INFINITY ? SILENCE_DB : quietest,
    clipped,
  };
}

/** Whether a summary shows a track that never carried any signal. */
export function isSilentSummary(summary: LevelSummary, thresholdDb = SILENT_PEAK_DB): boolean {
  if (summary.frames === 0) return false;
  return summary.peakDb <= thresholdDb;
}

/* -------------------------------------------------------------------------- */
/*  Errors and environment                                                     */
/* -------------------------------------------------------------------------- */

/** A message + hint pair, the way the panels show problems. */
export interface MicMessage {
  message: string;
  hint: string;
}

/** What the browser supports, as far as the microphone is concerned. */
export interface MicEnvironment {
  /** `window.isSecureContext`. */
  secureContext: boolean;
  /** `navigator.mediaDevices` exists. */
  hasMediaDevices: boolean;
  /** `navigator.mediaDevices.getUserMedia` exists. */
  hasGetUserMedia: boolean;
  /** `window.MediaRecorder` exists. */
  hasMediaRecorder: boolean;
}

/**
 * The first thing that blocks the panel, or `null` when everything is fine.
 *
 * Checked in order: an insecure page, no `getUserMedia` at all, and finally
 * no `MediaRecorder` (the meter still works, only recording is missing).
 */
export function checkMicEnvironment(env: MicEnvironment): MicMessage | null {
  if (!env.secureContext) {
    return {
      message: 'Microphone access needs a secure page.',
      hint: 'Open this page over https:// (or localhost) and try again — browsers block the microphone on plain http.',
    };
  }
  if (!env.hasMediaDevices || !env.hasGetUserMedia) {
    return {
      message: 'This browser cannot open a microphone.',
      hint: 'getUserMedia is unavailable here. Try a recent version of Chrome, Edge, Firefox or Safari.',
    };
  }
  if (!env.hasMediaRecorder) {
    return {
      message: 'This browser cannot record audio.',
      hint: 'The live level meter still works, but recording needs MediaRecorder — available in Chrome, Edge, Firefox and Safari 14.1+.',
    };
  }
  return null;
}

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '';
}

/**
 * Turn a `getUserMedia` rejection into something a person can act on.
 *
 * Every branch is a different problem with a different fix, so a single
 * "microphone failed" message would not be much help.
 */
export function describeMediaError(error: unknown): MicMessage {
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'PermissionDismissedError':
      return {
        message: 'Microphone permission was denied.',
        hint: 'Allow the microphone in the browser’s site settings (the padlock or camera icon in the address bar), then press Start again.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        message: 'No microphone was found.',
        hint: 'Plug one in, or pick an input in your operating system’s sound settings, then press Start again.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        message: 'The microphone could not be opened.',
        hint: 'Another app may be using it, or the system may be blocking it. Close the other app and press Start again.',
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        message: 'The microphone does not support the requested settings.',
        hint: 'Press Start again to retry with the default settings.',
      };
    case 'SecurityError':
      return {
        message: 'The browser blocked microphone access for this page.',
        hint: 'Microphone access needs a secure (https) page and your permission.',
      };
    case 'AbortError':
      return {
        message: 'The microphone was released before it started.',
        hint: 'Press Start again.',
      };
    case 'TypeError':
      return {
        message: 'This browser cannot open a microphone.',
        hint: 'getUserMedia is unavailable here. Try a recent version of Chrome, Edge, Firefox or Safari.',
      };
    default:
      return {
        message: 'The microphone could not be started.',
        hint: 'Check that a microphone is connected and allowed, then press Start again.',
      };
  }
}

/* -------------------------------------------------------------------------- */
/*  Recording formats                                                          */
/* -------------------------------------------------------------------------- */

/** A recording container the browser might be able to produce. */
export interface RecorderMime {
  /** The MIME type to hand to `MediaRecorder`. */
  mimeType: string;
  /** The file extension that matches it. */
  extension: string;
}

/** The containers we ask for, best first. */
export const RECORDER_MIME_CANDIDATES: readonly RecorderMime[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'mp4' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
];

/**
 * The first container the browser says it can record, or `null`.
 *
 * `null` means the browser supports none of the formats we know how to
 * name — the panel says so instead of handing over a mystery file.
 */
export function chooseRecorderMimeType(
  isSupported: (mimeType: string) => boolean,
): RecorderMime | null {
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    try {
      if (isSupported(candidate.mimeType)) return { ...candidate };
    } catch {
      /* a browser that throws is treated as "not supported" */
    }
  }
  return null;
}

/**
 * The file extension for a recorded blob.
 *
 * The blob's own MIME type decides — Chrome writes WebM, Safari writes MP4,
 * and the download must match what was actually recorded.
 */
export function extensionForMimeType(mimeType: string): string {
  const subtype =
    String(mimeType ?? '')
      .toLowerCase()
      .split(';')[0]!
      .split('/')[1] ?? '';
  if (!subtype) return 'webm';
  if (subtype === 'mpeg' || subtype === 'mpga') return 'mp3';
  if (subtype.includes('m4a')) return 'm4a';
  const clean = subtype.replace(/[^a-z0-9]+/g, '');
  return clean || 'webm';
}

/** Characters that must not appear in a file name. */
const UNSAFE_NAME_CHARS = /[/:*?"<>|\\]/g;

/** Remove control characters (invisible, but they break file systems). */
function stripControlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out;
}

/**
 * A safe file-name fragment.
 *
 * Unicode (including emoji) is preserved as-is; only path separators, control
 * characters and the characters Windows rejects are replaced.
 */
export function safeRecordingName(label: string, fallback = ''): string {
  const cleaned = stripControlChars(String(label ?? ''))
    .replace(UNSAFE_NAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return cleaned || fallback;
}

/** The download name for a recording: `<label>.<extension>`. */
export function recordingFilename(label: string, mimeType: string, fallback = 'recording'): string {
  const base = safeRecordingName(label, fallback);
  return `${base}.${extensionForMimeType(mimeType)}`;
}

/* -------------------------------------------------------------------------- */
/*  Time                                                                       */
/* -------------------------------------------------------------------------- */

/** `1:23.4` — the elapsed time of a recording. */
export function formatElapsed(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safe % 1000) / 100);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}.${tenths}` : `${minutes}:${ss}.${tenths}`;
}

/** `3.42` → `3.42 s`. */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  return `${seconds.toFixed(2)} s`;
}

/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

/** The meter ranges the tool offers, in dB below full scale. */
export const METER_RANGES = [40, 60, 90] as const;

/** The analysis frame sizes the tool offers, in samples. */
export const FRAME_SIZES = [256, 1024, 2048, 4096] as const;

/** Read the meter range option, failing loudly on an unknown value. */
export function readMeterRange(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !METER_RANGES.includes(n as (typeof METER_RANGES)[number])) {
    throw new ToolError(
      `“${String(value)}” is not a valid meter range.`,
      `Choose one of: ${METER_RANGES.join(', ')} dB.`,
    );
  }
  return n;
}

/** Read the analysis frame size option, failing loudly on an unknown value. */
export function readFrameSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !FRAME_SIZES.includes(n as (typeof FRAME_SIZES)[number])) {
    throw new ToolError(
      `“${String(value)}” is not a valid analysis frame size.`,
      `Choose one of: ${FRAME_SIZES.join(', ')} samples.`,
    );
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/*  The measurement payload                                                    */
/* -------------------------------------------------------------------------- */

/**
 * What the panel measured while the microphone was open.
 *
 * The panel owns the browser APIs and ships these raw numbers; the tool turns
 * them into decibels, a report and a download.
 */
export interface MicMeasurements {
  /** The label the browser gave the capture device. */
  deviceLabel: string;
  /** The sample rate of the capture, in Hz. */
  sampleRate: number;
  /** The number of channels on the captured track. */
  channels: number;
  /** The length of the recording, in milliseconds. */
  durationMs: number;
  /** The MIME type of the recorded blob. */
  mimeType: string;
  /** The linear RMS of every analysis window. */
  rms: number[];
  /** The linear peak of every analysis window. */
  peak: number[];
  /** The raw samples of the loudest window. */
  peakWindow: number[];
}

function readNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readNumberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new ToolError(
      'The microphone readings are malformed.',
      `The ${label} series is missing — record the clip again.`,
    );
  }
  const out: number[] = [];
  for (const entry of value) {
    const n = Number(entry);
    if (!Number.isFinite(n)) {
      throw new ToolError(
        'The microphone readings are malformed.',
        `The ${label} series contains a value that is not a number — record the clip again.`,
      );
    }
    out.push(n);
  }
  return out;
}

/**
 * Read the measurement payload the panel produced.
 *
 * Every failure is a `ToolError`: a report built from half-read numbers
 * would be worse than no report at all.
 */
export function parseMeasurements(payload: string | undefined | null): MicMeasurements {
  const text = typeof payload === 'string' ? payload.trim() : '';
  if (!text) {
    throw new ToolError(
      'The microphone readings are missing.',
      'Record a clip first — the panel sends the live level readings with it.',
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ToolError('The microphone readings could not be read.', 'Record the clip again.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ToolError('The microphone readings are malformed.', 'Record the clip again.');
  }

  const record = raw as Record<string, unknown>;
  const rms = readNumberArray(record.rms, 'RMS');
  const peak = readNumberArray(record.peak, 'peak');
  if (rms.length !== peak.length) {
    throw new ToolError(
      'The microphone readings are malformed.',
      'The RMS and peak series have different lengths — record the clip again.',
    );
  }

  const peakWindow: number[] = [];
  if (Array.isArray(record.peakWindow)) {
    for (const entry of record.peakWindow) {
      const n = Number(entry);
      if (Number.isFinite(n)) peakWindow.push(n);
    }
  }

  const label = typeof record.deviceLabel === 'string' ? record.deviceLabel.trim() : '';
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim() : '';

  return {
    deviceLabel: label || 'Microphone',
    sampleRate: Math.max(0, readNumber(record.sampleRate, 0)),
    channels: Math.max(1, Math.round(readNumber(record.channels, 1))),
    durationMs: Math.max(0, readNumber(record.durationMs, 0)),
    mimeType,
    rms,
    peak,
    peakWindow,
  };
}
