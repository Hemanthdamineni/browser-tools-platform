/**
 * The screen-recorder core — the pure, testable half.
 *
 * The shared recording machinery (container choice, chunk collection, error
 * mapping, elapsed time) lives in `webcam-recorder-core` and is reused as-is:
 * `startRecording()` takes an injected recorder factory, so the only thing
 * that differs from the webcam recorder is where the `MediaStream` comes
 * from — `getDisplayMedia()` instead of `getUserMedia()`.
 *
 * Everything in this file decides *which screen source is offered*, *which
 * tracks end up in the recording* and *how the capture failures are
 * explained*. None of it touches `window`, `document` or the network, and the
 * browser APIs are injected so the whole flow can be unit-tested in Node.
 */
import { ToolError } from '@/lib/types';
import { insecureContextError } from './webcam-recorder-core';

/* -------------------------------------------------------------------------- */
/*  The screen request                                                         */
/* -------------------------------------------------------------------------- */

/**
 * What to prefer when the browser shows its share picker. `window` keeps the
 * prompt tight (no whole-desktop option), `monitor` asks for the whole screen
 * first, and `''` — the default — leaves the choice entirely to the browser.
 */
export const SURFACE_PREFERENCES = ['', 'monitor', 'window'] as const;

export type SurfacePreference = (typeof SURFACE_PREFERENCES)[number];

/**
 * The `DisplayMediaStreamOptions` the recorder hands to `getDisplayMedia` for
 * a surface-preference option value. `null` (the "let the browser decide"
 * value) means no `video` preferences at all.
 *
 * These are hints, not demands: every browser ignores what it does not know,
 * and the user always has the final say in the share picker.
 */
export function displayMediaOptionsForSurface(
  surface: string | null | undefined,
): DisplayMediaStreamOptions | null {
  switch (String(surface ?? '')) {
    case 'monitor':
      return { video: { displaySurface: 'monitor' }, audio: false };
    case 'window':
      return { video: { displaySurface: 'window' }, audio: false };
    default:
      return null;
  }
}

/** The shape of `navigator.mediaDevices` the screen recorder needs. */
export interface ScreenCaptureDevicesLike {
  getDisplayMedia?: (options?: DisplayMediaStreamOptions | undefined) => Promise<MediaStream>;
}

/** The shape of the global `MediaDevices` constructor the mic toggle needs. */
export interface UserMediaDevicesLike {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
}

/**
 * Check whether this page can offer screen capture at all.
 *
 * @param devices `navigator.mediaDevices`.
 * @returns the error to show, or `null` when `getDisplayMedia` can be called.
 */
export function screenCaptureError(devices: unknown): ToolError | null {
  const hasApi =
    !!devices && typeof (devices as ScreenCaptureDevicesLike).getDisplayMedia === 'function';
  return hasApi ? null : insecureContextError();
}

/**
 * Open the screen share prompt and return the display stream.
 *
 * `audio` stays off here — the microphone is mixed in separately by
 * `addMicrophoneTrack`, so the share picker's own audio checkbox is the only
 * thing that can put other audio (tab sound) in the display stream.
 *
 * @throws the `getDisplayMedia` rejection verbatim — the panel maps it to a
 *   friendly message with `describeCaptureError`.
 */
export async function requestScreen(
  devices: ScreenCaptureDevicesLike | undefined | null,
  options: { surface?: string | null } = {},
): Promise<MediaStream> {
  const captureOptions = displayMediaOptionsForSurface(options.surface);
  return devices!.getDisplayMedia!(captureOptions ?? undefined);
}

/**
 * Mix the microphone into a screen recording.
 *
 * The mic stream is opened separately from the share prompt: screen capture
 * and microphone permission are unrelated, and keeping the mic off the
 * display stream means stopping one never silences the other.
 *
 * @returns the display stream with the microphone audio track(s) added, or
 *   the display stream unchanged when `mic` is off.
 * @throws the `getUserMedia` rejection verbatim — the panel maps it to a
 *   friendly message with `describeCaptureError`.
 */
export async function addMicrophoneTrack(
  display: MediaStream,
  devices: UserMediaDevicesLike | undefined | null,
  options: { mic?: boolean } = {},
): Promise<MediaStream> {
  if (options.mic !== true || !devices || typeof devices.getUserMedia !== 'function') {
    return display;
  }
  const mic = await devices.getUserMedia({ audio: true, video: false });
  for (const track of mic.getAudioTracks()) {
    display.addTrack(track);
  }
  // The mic stream object itself is redundant now that its track lives on the
  // display stream; stopping it here would end the track, so it is left alive
  // and the caller stops the display stream's tracks.
  return display;
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Turn a `getDisplayMedia` rejection into a user-facing error. The names are
 * a superset of `getUserMedia`'s, so the shared `describeCaptureError` gets
 * most of the way there — this adds the screen-specific wording on top.
 */
export function describeScreenCaptureError(err: unknown): ToolError {
  const e = err as { name?: string; message?: string } | null | undefined;
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new ToolError(
        'Screen sharing was cancelled or denied.',
        'Pick a screen or window in the browser’s share prompt — recording only starts once something is shared.',
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new ToolError(
        'No screen or window was available to share.',
        'Screen capture needs a desktop browser. On phones and tablets it is not available.',
      );
    case 'NotReadableError':
    case 'TrackStartError':
      return new ToolError(
        'The screen could not be captured.',
        'Another app may be holding the display content (some video players and protected pages do this). Close it or pick a different window, then try again.',
      );
    default:
      return new ToolError(
        e?.message || 'The screen could not be captured.',
        'Press Share screen again — if it keeps failing, try sharing a different window or tab.',
      );
  }
}
