/**
 * Webcam Test — the pure, testable half.
 *
 * This module handles:
 * - listing cameras
 * - building video constraints (resolution + fps)
 * - requesting camera access
 * - reading back the actual track settings (width / height / frameRate)
 * - formatting the resolution and fps readout
 * - taking a single snapshot
 *
 * Everything is browser-agnostic and injectable for testing. Nothing here
 * touches the network — the stream only ever exists in this tab.
 */
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  MediaDeviceInfo & constraints                                             */
/* -------------------------------------------------------------------------- */

export interface MediaDevicesLike {
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
}

export interface MediaTrackConstraintsLike {
  deviceId?: string | { exact: string };
  width?: number | { ideal: number };
  height?: number | { ideal: number };
  frameRate?: number | { ideal: number };
}

/** The shape of the video constraints we build from options. */
export interface VideoConstraints {
  deviceId?: string | { exact: string };
  width?: { ideal: number };
  height?: { ideal: number };
  frameRate?: { ideal: number };
}

/** Map our high-level options to the real MediaTrackConstraints. */
export function videoConstraintsForOptions(
  resolution: string,
  fps: string,
  deviceId?: string | null,
): VideoConstraints {
  const constraints: VideoConstraints = {};

  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
  }

  // Resolution presets ("1280x720") — "auto" leaves the choice to the camera.
  if (resolution && resolution !== 'auto') {
    const [w, h] = resolution.split('x').map(Number);
    if (w && h) {
      constraints.width = { ideal: w };
      constraints.height = { ideal: h };
    }
  }

  // FPS — "auto" leaves the frame rate to the camera.
  if (fps && fps !== 'auto') {
    const fpsNum = Number(fps);
    if (fpsNum > 0) {
      constraints.frameRate = { ideal: fpsNum };
    }
  }

  return constraints;
}

/* -------------------------------------------------------------------------- */
/*  Track settings readout                                                    */
/* -------------------------------------------------------------------------- */

/** What the browser reports about the live track. */
export interface TrackReadout {
  width: number;
  height: number;
  frameRate: number;
  label: string;
}

/** Read the actual width/height/framerate the browser accepted. */
export function readTrackSettings(track: MediaStreamTrack | undefined): TrackReadout {
  const settings = track?.getSettings?.() ?? {};
  return {
    width: settings.width ?? 0,
    height: settings.height ?? 0,
    frameRate: settings.frameRate ?? 0,
    label: track?.label ?? '',
  };
}

/** One line of the resolution/fps readout, e.g. "1920 × 1080 @ 30 fps". */
export function formatReadout(readout: TrackReadout): string {
  const fps = Number.isFinite(readout.frameRate)
    ? Math.round(readout.frameRate)
    : readout.frameRate;
  return `${readout.width} × ${readout.height} @ ${fps} fps`;
}

/* -------------------------------------------------------------------------- */
/*  Device listing                                                            */
/* -------------------------------------------------------------------------- */

/** List video-input devices; returns [] when the API is missing or fails. */
export async function listCameras(
  devices: MediaDevicesLike | undefined | null = navigator.mediaDevices,
): Promise<MediaDeviceInfo[]> {
  if (!devices?.enumerateDevices) {
    return [];
  }
  try {
    const all = await devices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Camera access                                                             */
/* -------------------------------------------------------------------------- */

/** Ask for camera permission and get a MediaStream. */
export async function requestCamera(
  constraints: MediaTrackConstraintsLike,
  mediaDevices:
    | {
        getUserMedia: (c: {
          video: MediaTrackConstraintsLike;
          audio?: boolean;
        }) => Promise<MediaStream>;
      }
    | undefined,
): Promise<MediaStream> {
  if (!mediaDevices?.getUserMedia) {
    throw new ToolError(
      'This browser does not expose a camera API.',
      'Camera access needs a recent Chrome, Edge, Firefox or Safari over https:// or localhost.',
    );
  }
  try {
    return await mediaDevices.getUserMedia({ video: constraints, audio: false });
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    switch (e?.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        throw new ToolError(
          'Camera permission was denied.',
          'Allow camera access for this site — open the padlock in the address bar, set Camera to “Allow”, then try again.',
        );
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        throw new ToolError(
          'No camera was found on this device.',
          'Check that a camera is connected and not disabled in your system settings.',
        );
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':
        throw new ToolError(
          'The camera is already in use.',
          'Close other apps or tabs using the camera, then try again.',
        );
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        throw new ToolError(
          'This camera does not support the requested settings.',
          'Try “Auto” for resolution or frame rate.',
        );
      case 'SecurityError':
        throw new ToolError(
          'Camera access is blocked on this page.',
          'Browsers only allow cameras on secure pages — open this tool over https:// (or localhost).',
        );
      default:
        throw new ToolError(
          e?.message || 'The camera could not be started.',
          'Check the camera connection and browser permissions, then try again.',
        );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Snapshot utilities                                                        */
/* -------------------------------------------------------------------------- */

export interface SnapshotSource {
  video: HTMLVideoElement;
  width: number;
  height: number;
}

/**
 * Draw the current video frame onto a canvas and encode it as PNG.
 * Pure aside from the canvas: the stream must already be live.
 */
export async function captureFrame(
  source: SnapshotSource,
  toBlob: (cb: (blob: Blob | null) => void, type?: string) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ToolError('Canvas is unavailable in this browser.');
  }
  ctx.drawImage(source.video, 0, 0, source.width, source.height);

  const { promise, resolve, reject } = Promise.withResolvers<Blob>();
  toBlob((b) => {
    if (b) resolve(b);
    else reject(new ToolError('The snapshot could not be encoded.'));
  }, 'image/png');
  const blob = await promise;
  canvas.width = canvas.height = 0;
  return blob;
}

/** Suggested filename for a snapshot, e.g. "webcam-snapshot-2026-10-27-12-30-05.png". */
export function snapshotFilename(date: Date, prefix: string = 'webcam-snapshot'): string {
  const ts = date
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\.\d+Z$/, '');
  return `${prefix}-${ts}.png`;
}

/** Stop every track on a stream (safe on already-stopped streams). */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
