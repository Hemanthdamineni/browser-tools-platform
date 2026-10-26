/**
 * Pure helpers for the screen recorder.
 *
 * `getDisplayMedia` and `MediaRecorder` are main-thread browser APIs, so the
 * capture UI lives in a dedicated panel (`screen-recorder.astro`). This
 * module holds everything that does *not* need a DOM:
 *
 * - the MIME-type decision (WebM by default, MP4 only where the browser can
 *   really record it),
 * - the elapsed-time and duration formats,
 * - the friendly messages for a denied permission or a missing API.
 *
 * Nothing here touches `window`, `navigator` or the network, so it is unit
 * tested directly.
 */

/** The container a recording is written in. */
export type RecordingFormat = 'webm' | 'mp4';

/** MIME types tried for a WebM recording, best first. */
export const WEBM_MIME_CANDIDATES: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/** MIME types tried for an MP4 recording, best first. */
export const MP4_MIME_CANDIDATES: readonly string[] = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
];

/**
 * Largest recording the tool will hand back. A long capture is held in memory
 * while it is written, so an oversized file is refused with a clear message
 * instead of quietly killing the tab.
 */
export const MAX_RECORDING_BYTES = 1024 * 1024 * 1024; // 1 GB

/**
 * Pick the MIME type to record with.
 *
 * `supported` is normally `MediaRecorder.isTypeSupported`. The preferred
 * format is tried first; the other one is only used as a fallback so a browser
 * that can record *something* is never left without a recorder. MP4 is never
 * returned unless the browser says it supports it.
 *
 * Returns `null` when the browser supports no container at all.
 */
export function pickMimeType(
  supported: (type: string) => boolean,
  format: RecordingFormat = 'webm',
): string | null {
  const candidates =
    format === 'mp4'
      ? [...MP4_MIME_CANDIDATES, ...WEBM_MIME_CANDIDATES]
      : [...WEBM_MIME_CANDIDATES, ...MP4_MIME_CANDIDATES];
  for (const candidate of candidates) {
    let ok = false;
    try {
      ok = supported(candidate);
    } catch {
      ok = false;
    }
    if (ok) return candidate;
  }
  return null;
}

/** Whether this browser can record MP4 at all. */
export function supportsMp4(supported: (type: string) => boolean): boolean {
  return pickMimeType(supported, 'mp4')?.startsWith('video/mp4') === true;
}

/** Whether this browser can record WebM at all. */
export function supportsWebm(supported: (type: string) => boolean): boolean {
  return pickMimeType(supported, 'webm')?.startsWith('video/webm') === true;
}

/** The container a MIME type belongs to, or `null` when it is not a video. */
export function formatForMimeType(mime: string): RecordingFormat | null {
  const value = String(mime ?? '')
    .toLowerCase()
    .trim();
  if (!value) return null;
  // Only the base type counts — `video/webm;codecs=vp9` is still WebM.
  const type = value.split(';')[0]!.trim();
  if (type === 'video/mp4' || type === 'application/mp4') return 'mp4';
  if (type === 'video/webm') return 'webm';
  return null;
}

/** The container a file name suggests, or `null` when the name says nothing. */
export function formatFromFileName(name: string): RecordingFormat | null {
  const value = String(name ?? '').toLowerCase();
  if (/\.(mp4|m4v|mov)$/.test(value)) return 'mp4';
  if (/\.webm$/.test(value)) return 'webm';
  return null;
}

/** The file extension used for a container. */
export function extensionForFormat(format: RecordingFormat): 'webm' | 'mp4' {
  return format === 'mp4' ? 'mp4' : 'webm';
}

/** A human name for a container. */
export function labelForFormat(format: RecordingFormat): string {
  return format === 'mp4' ? 'MP4 (H.264)' : 'WebM';
}

/**
 * The name of the produced file. Keeps the extension of the container that
 * was really recorded, whatever the input was called.
 */
export function outputFileName(inputName: string, format: RecordingFormat): string {
  const raw = String(inputName ?? '').trim();
  const base = raw
    .replace(/\.[^./\\]+$/, '')
    .replace(/[\\/]+/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return `${base || 'screen-recording'}.${extensionForFormat(format)}`;
}

/** A timestamped name for a fresh recording, e.g. `screen-recording-2026-10-21-16-04-07.webm`. */
export function recordingFileName(when: Date, format: RecordingFormat): string {
  const d = when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
  return `screen-recording-${stamp}.${extensionForFormat(format)}`;
}

/**
 * The running timer: `m:ss`, or `h:mm:ss` from an hour on. Negative or broken
 * values read as `0:00` rather than `NaN`.
 */
export function formatElapsed(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A duration in words: `12.4 s`, `1 m 05 s`, `1 h 02 m 03 s`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 'Unknown';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const total = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, '0');
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h > 0) return `${h} h ${pad(m)} m ${pad(s)} s`;
  return `${m} m ${pad(s)} s`;
}

/**
 * Read a duration in seconds from an option value. Returns `null` when the
 * value is missing or not a usable number, so the caller can say "unknown"
 * instead of inventing a length.
 */
export function normalizeDuration(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Read a bitrate from an option value, or `null` when it is unusable. */
export function normalizeBitrate(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** What went wrong while asking for the screen or the microphone. */
export interface CaptureErrorInfo {
  message: string;
  hint?: string;
}

/**
 * Turn a `getDisplayMedia` / `getUserMedia` rejection into a message a person
 * can act on. A denied prompt is a normal outcome, not a crash.
 */
export function describeCaptureError(
  err: unknown,
  subject: 'screen' | 'microphone' = 'screen',
): CaptureErrorInfo {
  const e = err as { name?: string; message?: string } | undefined;
  const screen = subject === 'screen';
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        message: screen
          ? 'Screen sharing permission was denied.'
          : 'Microphone permission was denied.',
        hint: screen
          ? 'Allow screen capture for this site (the padlock in the address bar), then press Share screen again.'
          : 'Allow microphone access for this site (the padlock in the address bar), then press Microphone again — the recording works without it too.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        message: screen
          ? 'No screen or window was selected.'
          : 'No microphone was found on this device.',
        hint: screen
          ? 'Pick a screen, window or tab in the browser prompt and choose Allow.'
          : 'Check that a microphone is connected and enabled in your system settings.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        message: screen
          ? 'The screen could not be captured.'
          : 'The microphone could not be opened.',
        hint: screen
          ? 'Another app or tab may be recording the same screen — close it and try again.'
          : 'Another app may be using the microphone — close it and try again.',
      };
    case 'AbortError':
      return {
        message: screen ? 'The screen picker was closed.' : 'The microphone request was cancelled.',
        hint: screen ? 'Press Share screen again to pick what to record.' : undefined,
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        message: screen
          ? 'That source could not be shared with the requested settings.'
          : 'That microphone could not be used with the requested settings.',
        hint: 'Try again and accept the default settings.',
      };
    case 'TypeError':
      return {
        message: screen
          ? 'This browser cannot share a screen.'
          : 'This browser cannot open a microphone.',
        hint: screen
          ? 'Screen recording needs a recent Chrome, Edge, Firefox or Safari 13+, on a secure (https) page.'
          : 'The microphone needs a recent Chrome, Edge, Firefox or Safari, on a secure (https) page.',
      };
    default:
      return {
        message:
          e?.message ||
          (screen ? 'The screen could not be shared.' : 'The microphone could not be opened.'),
        hint: screen
          ? 'Press Share screen again to retry.'
          : 'Press Microphone again to retry — the recording works without it too.',
      };
  }
}
