/**
 * Webcam recorder — the pure, testable half.
 *
 * Everything that decides *what* gets recorded, *how long* it runs and *what
 * the download is called* lives here. The browser APIs (`getUserMedia`,
 * `MediaRecorder`) are injected, so the whole capture → record → package flow
 * can be unit-tested in Node.
 *
 * Nothing in this file touches `window`, `document` or the network.
 *
 * REUSE POINT: `startRecording()` below is the reusable capture/record
 * helper. A future screen recorder only has to hand it a `MediaStream` from
 * `getDisplayMedia()` instead of `getUserMedia()` — the MIME-type choice,
 * the chunk collection, the error mapping and the elapsed-time formatting
 * are all shared through this module.
 */
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Containers & MIME types                                                     */
/* -------------------------------------------------------------------------- */

/** The container of a recorded clip. */
export type RecordingContainer = 'webm' | 'mp4';

/**
 * Containers in the order we would like to record them: VP9 first (best
 * compression at the same quality), then VP8, then plain WebM. MP4 comes
 * last — it is only ever picked when the browser says it supports it
 * (Safari does, Chromium does not).
 */
export const RECORDING_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
] as const;

/** "Let the browser pick its own container" — pass no `mimeType` at all. */
export const DEFAULT_RECORDING_MIME = '';

/** `MediaRecorder.isTypeSupported` (or a stub of it). */
export type MimeSupportProbe = (type: string) => boolean;

/**
 * Choose the MIME type to hand to `new MediaRecorder(stream, { mimeType })`.
 *
 * @param support `MediaRecorder.isTypeSupported`, or `null` when the browser
 *   does not expose the check at all — the browser's own default container is
 *   used then.
 * @returns the MIME type, or `null` when the browser supports none of the
 *   containers we know about (the caller then says so out loud).
 */
export function pickRecordingMimeType(support: MimeSupportProbe | null | undefined): string | null {
  if (typeof support !== 'function') return DEFAULT_RECORDING_MIME;
  for (const candidate of RECORDING_MIME_CANDIDATES) {
    if (support(candidate)) return candidate;
  }
  return null;
}

/**
 * The container of a recorded clip. Unknown containers fall back to WebM,
 * which is what every browser that can record produces.
 */
export function containerForMimeType(mimeType: string | null | undefined): RecordingContainer {
  const type = (mimeType ?? '').toLowerCase();
  if (type.includes('mp4')) return 'mp4';
  return 'webm';
}

/* -------------------------------------------------------------------------- */
/*  Filenames                                                                   */
/* -------------------------------------------------------------------------- */

/** Filename prefix used when the user does not pick one. */
export const DEFAULT_FILENAME_PREFIX = 'webcam-recording';

/** Drop control characters — they have no business in a file name. */
function stripControlCharacters(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += char;
  }
  return out;
}

/**
 * Make a user-supplied filename prefix safe to use as a filename: no path
 * separators, no characters Windows forbids, no leading dots, no control
 * characters. An empty result falls back to the default prefix.
 */
export function sanitizeFilenamePrefix(raw: string | null | undefined): string {
  const cleaned = stripControlCharacters(String(raw ?? ''))
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // No leading dots or dashes: ".." must never survive into a file name.
    .replace(/^[.-]+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 60)
    .trim();
  return cleaned || DEFAULT_FILENAME_PREFIX;
}

/** `YYYY-MM-DD-HH-mm-ss` in local time — safe on every filesystem. */
export function formatTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${day}-${time}`;
}

/**
 * The name of the downloaded clip, e.g.
 * `webcam-recording-2026-10-21-17-31-08.webm`.
 */
export function buildRecordingFilename(
  container: RecordingContainer,
  date: Date,
  prefix: string | null | undefined = DEFAULT_FILENAME_PREFIX,
): string {
  return `${sanitizeFilenamePrefix(prefix)}-${formatTimestamp(date)}.${container}`;
}

/* -------------------------------------------------------------------------- */
/*  Timing                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Elapsed time as `MM:SS`, or `H:MM:SS` once the recording passes an hour.
 * Negative and non-finite values are treated as zero.
 */
export function formatElapsed(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const total = Math.floor(safe / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/* -------------------------------------------------------------------------- */
/*  Quality                                                                     */
/* -------------------------------------------------------------------------- */

/** Target video bitrates for the quality option, in bits per second. */
export const RECORDING_BITRATES = {
  small: 1_000_000,
  balanced: 2_500_000,
  high: 6_000_000,
} as const;

export type RecordingQuality = keyof typeof RECORDING_BITRATES;

/** The bitrate for a quality option value; unknown values fall back to `balanced`. */
export function bitrateForQuality(quality: string | null | undefined): number {
  const key = String(quality ?? '') as RecordingQuality;
  return RECORDING_BITRATES[key] ?? RECORDING_BITRATES.balanced;
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                      */
/* -------------------------------------------------------------------------- */

/** The page is not a secure context, so no camera is reachable. */
export function insecureContextError(): ToolError {
  return new ToolError(
    'This page cannot reach the camera.',
    'Browsers only allow camera access on secure pages — open this tool over https:// (or http://localhost) and try again.',
  );
}

/** The browser has no `MediaRecorder` at all. */
export function mediaRecorderUnavailableError(): ToolError {
  return new ToolError(
    'This browser cannot record video.',
    'MediaRecorder is missing here — try a recent Chrome, Edge, Firefox or Safari.',
  );
}

/** No container we can save is supported. */
export function noSupportedMimeTypeError(): ToolError {
  return new ToolError(
    'This browser cannot record the camera in a format we can save.',
    'Try a recent Chrome, Edge, Firefox or Safari — Safari records MP4, the others record WebM.',
  );
}

/** The user stopped the recording before a single frame was captured. */
export function emptyRecordingError(): ToolError {
  return new ToolError(
    'The recording was empty — there is nothing to save.',
    'Press Record and let it run for a second or two before pressing Stop.',
  );
}

/**
 * Check whether this page can reach a camera at all.
 *
 * @param mediaDevices `navigator.mediaDevices`.
 * @returns the error to show, or `null` when the camera can be requested.
 */
export function cameraAccessError(mediaDevices: unknown): ToolError | null {
  const hasApi =
    !!mediaDevices &&
    typeof (mediaDevices as { getUserMedia?: unknown }).getUserMedia === 'function';
  return hasApi ? null : insecureContextError();
}

/**
 * Check whether this browser can record at all.
 *
 * @param mediaRecorder the `MediaRecorder` constructor (or `undefined`).
 * @returns the error to show, or `null` when recording is possible.
 */
export function recorderSupportError(mediaRecorder: unknown): ToolError | null {
  return typeof mediaRecorder === 'function' ? null : mediaRecorderUnavailableError();
}

/**
 * Turn a `getUserMedia` rejection into a user-facing error.
 */
export function describeCaptureError(err: unknown): ToolError {
  const e = err as { name?: string; message?: string } | null | undefined;
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new ToolError(
        'Camera permission was denied.',
        'Allow camera access for this site — open the padlock in the address bar, set Camera to “Allow”, then press Record again.',
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new ToolError(
        'No camera was found on this device.',
        'Check that a camera is connected and not disabled in your system settings, then try again.',
      );
    case 'NotReadableError':
    case 'TrackStartError':
      return new ToolError(
        'The camera is already in use.',
        'Close other apps or tabs that are using the camera (video calls, other tabs), then try again.',
      );
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new ToolError(
        'This camera does not support the requested settings.',
        'Try again — the recorder asks for the default camera with no extra constraints.',
      );
    case 'SecurityError':
      return new ToolError(
        'Camera access is blocked on this page.',
        'Browsers only allow the camera on secure pages — open this tool over https:// (or http://localhost) and try again.',
      );
    case 'TypeError':
      return new ToolError(
        'This browser does not expose a camera API.',
        'Camera access needs a recent Chrome, Edge, Firefox or Safari.',
      );
    default:
      return new ToolError(
        e?.message || 'The camera could not be started.',
        'Check that the camera is connected and not in use by another app, then try again.',
      );
  }
}

/**
 * Turn a `MediaRecorder` failure (including the `error` event it fires when
 * it dies mid-recording) into a user-facing error.
 */
export function describeRecorderError(err: unknown): ToolError {
  const e = err as { name?: string; message?: string } | null | undefined;
  switch (e?.name) {
    case 'NotSupportedError':
      return new ToolError(
        'This browser cannot record the camera in a supported format.',
        'Try a recent Chrome, Edge, Firefox or Safari — Safari records MP4, the others record WebM.',
      );
    case 'NotReadableError':
      return new ToolError(
        'The camera stopped delivering frames.',
        'Another app may have taken the camera — close it and record again.',
      );
    case 'SecurityError':
      return new ToolError(
        'Recording is blocked on this page.',
        'Browsers only allow the camera on secure pages — open this tool over https:// (or http://localhost) and try again.',
      );
    case 'AbortError':
      return new ToolError(
        'The recording was interrupted before it finished.',
        'Try recording again — nothing was saved.',
      );
    case 'InvalidStateError':
      return new ToolError(
        'The recorder was in the wrong state.',
        'Press Record again to start a new clip.',
      );
    case 'TypeError':
      return new ToolError(
        'The camera stream could not be recorded.',
        'Close other apps that are using the camera and try again.',
      );
    default:
      return new ToolError(
        e?.message || 'The recording failed.',
        'Try again — if it keeps failing, check that the camera works in another app.',
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  Recording session                                                           */
/* -------------------------------------------------------------------------- */

/** The parts of `MediaRecorder` the recorder needs. */
export interface RecorderLike {
  start(timeslice?: number): void;
  stop(): void;
  readonly mimeType?: string;
  ondataavailable: ((event: BlobEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onstop: ((event: Event) => void) | null;
}

/** Builds the recorder — injected so the flow can be tested without a browser. */
export interface RecorderFactory {
  /** `MediaRecorder.isTypeSupported`, or `null` when the browser lacks it. */
  isTypeSupported?: MimeSupportProbe | null;
  /** Create a recorder for the stream. */
  create(
    stream: MediaStream,
    options: { mimeType?: string; videoBitsPerSecond?: number },
  ): RecorderLike;
}

/** A finished recording. */
export interface RecordedClip {
  /** The recorded frames. */
  blob: Blob;
  /** The MIME type the browser actually recorded. */
  mimeType: string;
  /** The container the clip is in. */
  container: RecordingContainer;
  /** How long the recording ran, in milliseconds. */
  durationMs: number;
}

/** A recording in progress. */
export interface RecordingSession {
  /** The MIME type the recorder was started with. */
  readonly mimeType: string;
  /** Stop the recording. Safe to call more than once. */
  stop(): void;
  /** Resolve with the finished clip; rejects with a `ToolError`. */
  result(): Promise<RecordedClip>;
}

export interface StartRecordingOptions {
  /** Target bitrate in bits per second. */
  videoBitsPerSecond?: number;
  /** How often the browser hands over a chunk, in milliseconds. */
  timesliceMs?: number;
  /** Clock — injected so the elapsed time can be tested. */
  now?: () => number;
}

/**
 * Start recording a stream and collect the chunks.
 *
 * The browser APIs are injected through `factory`, so this function is the
 * piece a future screen recorder reuses: hand it a `MediaStream` from
 * `getDisplayMedia()` instead of `getUserMedia()` and everything else —
 * container choice, chunk collection, error mapping, elapsed time — is
 * identical.
 *
 * @throws ToolError when the browser supports no container we can save.
 */
export function startRecording(
  stream: MediaStream,
  factory: RecorderFactory,
  options: StartRecordingOptions = {},
): RecordingSession {
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const mimeType = pickRecordingMimeType(factory.isTypeSupported ?? null);
  if (mimeType === null) throw noSupportedMimeTypeError();

  const recorderOptions: { mimeType?: string; videoBitsPerSecond?: number } = {};
  if (mimeType) recorderOptions.mimeType = mimeType;
  if (options.videoBitsPerSecond) recorderOptions.videoBitsPerSecond = options.videoBitsPerSecond;

  let recorder: RecorderLike;
  try {
    recorder = factory.create(stream, recorderOptions);
  } catch (err) {
    throw describeRecorderError(err);
  }

  const chunks: Blob[] = [];
  let failure: ToolError | null = null;
  let stopRequested = false;
  let settle: (() => void) | null = null;
  let fail: ((err: unknown) => void) | null = null;
  const finished = new Promise<void>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  recorder.ondataavailable = (event) => {
    const data = event?.data;
    if (data && data.size > 0) chunks.push(data);
  };
  recorder.onerror = (event) => {
    failure ??= describeRecorderError(event?.error);
    fail?.(failure);
  };
  recorder.onstop = () => settle?.();
  try {
    recorder.start(options.timesliceMs);
  } catch (err) {
    throw describeRecorderError(err);
  }

  return {
    mimeType,
    stop() {
      if (stopRequested) return;
      stopRequested = true;
      try {
        recorder.stop();
      } catch (err) {
        failure ??= describeRecorderError(err);
        fail?.(failure);
      }
    },
    async result() {
      await finished;
      if (failure) throw failure;
      if (!chunks.length) throw emptyRecordingError();
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type });
      return {
        blob,
        mimeType: type,
        container: containerForMimeType(type),
        durationMs: Math.max(0, now() - startedAt),
      };
    },
  };
}
