/**
 * Pure helpers behind the Webcam Test panel.
 *
 * Nothing here touches the DOM, `navigator` or a camera. The panel measures the
 * live stream (`getUserMedia` + `track.getSettings()` + presented-frame
 * timings), serialises the numbers to JSON and hands them to this tool's `run()`,
 * which turns the snapshot plus those numbers into the report. Keeping every
 * rule below DOM-free is what makes it unit-testable in jsdom.
 */
import { ToolError } from '@/lib/types';
import { formatBytes, formatDuration, pluralize } from '@/lib/format';

/** A bigger "snapshot" is a bug (or a hostile file), not a webcam frame. */
export const MAX_SNAPSHOT_EDGE = 16_384;
export const MAX_SNAPSHOT_PIXELS = 40_000_000;
/** Rolling window the live frame rate is measured over. */
export const FRAME_WINDOW_MS = 2_000;

/* -------------------------------------------------------------------------- */
/*  Probe shape                                                               */
/* -------------------------------------------------------------------------- */

/** Where the frame timings came from. */
export type FpsSource = 'video-frame' | 'raf';

export interface TrackSettings {
  width: number | null;
  height: number | null;
  /** Frame rate the camera reports for the track, if it reports one. */
  frameRate: number | null;
  aspectRatio: number | null;
  facingMode: string | null;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  /** True for the camera the live stream is actually using. */
  active: boolean;
}

/** Everything the panel measured, in the shape `run()` consumes. */
export interface CaptureProbe {
  deviceId: string;
  deviceLabel: string;
  settings: TrackSettings;
  /** Frames presented per second during the sampling window, or null. */
  fps: number | null;
  /** Frames observed in the sampling window. */
  frames: number;
  /** Length of the sampling window in milliseconds. */
  sampleMs: number;
  fpsSource: FpsSource;
  /** Every video input the browser listed, or null when none were reported. */
  devices: CameraDevice[] | null;
}

/** The probe for a run that has no live camera readings (e.g. an uploaded file). */
export function emptyProbe(): CaptureProbe {
  return {
    deviceId: '',
    deviceLabel: '',
    settings: {
      width: null,
      height: null,
      frameRate: null,
      aspectRatio: null,
      facingMode: null,
    },
    fps: null,
    frames: 0,
    sampleMs: 0,
    fpsSource: 'video-frame',
    devices: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function malformed(field: string): ToolError {
  return new ToolError(
    `The camera details were malformed (${field}).`,
    'Take a fresh snapshot — the camera panel fills this in automatically.',
  );
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw malformed(key);
  return value;
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  { integer = false }: { integer?: boolean } = {},
): number | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw malformed(key);
  if (integer && !Number.isInteger(value)) throw malformed(key);
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') throw malformed(key);
  return value;
}

function parseDevices(raw: unknown): CameraDevice[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) throw malformed('devices');
  return raw.map((entry, index) => {
    if (!isPlainObject(entry)) throw malformed(`devices[${index}]`);
    return {
      deviceId: readString(entry, 'deviceId') ?? '',
      label: readString(entry, 'label') ?? '',
      active: readBoolean(entry, 'active'),
    };
  });
}

/**
 * Read the panel's JSON reading probe. An absent value is fine (the tool stays
 * usable without a camera), but anything present must be well-formed — a
 * half-parsed report would be worse than an error.
 */
export function parseCaptureProbe(raw: unknown): CaptureProbe {
  if (raw === undefined || raw === null || raw === '') return emptyProbe();
  if (typeof raw !== 'string') throw malformed('capture');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError(
      'The camera details were not valid JSON.',
      'Take a fresh snapshot — the camera panel fills this in automatically.',
    );
  }
  if (!isPlainObject(parsed)) throw malformed('capture');

  const rawSettings = parsed.settings;
  if (rawSettings !== undefined && rawSettings !== null && !isPlainObject(rawSettings)) {
    throw malformed('settings');
  }
  const settingsSource = (rawSettings ?? {}) as Record<string, unknown>;

  const rawSource = readString(parsed, 'fpsSource');
  if (rawSource !== null && rawSource !== 'video-frame' && rawSource !== 'raf') {
    throw malformed('fpsSource');
  }

  return {
    deviceId: readString(parsed, 'deviceId') ?? '',
    deviceLabel: readString(parsed, 'deviceLabel') ?? '',
    settings: {
      width: readNumber(settingsSource, 'width'),
      height: readNumber(settingsSource, 'height'),
      frameRate: readNumber(settingsSource, 'frameRate'),
      aspectRatio: readNumber(settingsSource, 'aspectRatio'),
      facingMode: readString(settingsSource, 'facingMode'),
    },
    fps: readNumber(parsed, 'fps'),
    frames: readNumber(parsed, 'frames', { integer: true }) ?? 0,
    sampleMs: readNumber(parsed, 'sampleMs') ?? 0,
    fpsSource: rawSource ?? 'video-frame',
    devices: parseDevices(parsed.devices),
  };
}

/* -------------------------------------------------------------------------- */
/*  Measuring                                                                 */
/* -------------------------------------------------------------------------- */

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Frames per second from the timestamps of frames the browser presented.
 * `null` when fewer than two frames (or a zero-length span) were seen.
 */
export function fpsFromTimestamps(timestamps: readonly number[]): number | null {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return null;
  const first = timestamps[0]!;
  const last = timestamps[timestamps.length - 1]!;
  const span = last - first;
  if (!Number.isFinite(span) || span <= 0) return null;
  const fps = ((timestamps.length - 1) * 1000) / span;
  return Number.isFinite(fps) && fps > 0 ? round1(fps) : null;
}

/**
 * Drop timestamps older than the rolling window. Returns the input array
 * unchanged (the same reference) when nothing has aged out, so the live loop
 * does not allocate on every frame.
 */
export function trimFrameWindow(
  timestamps: number[],
  now: number,
  windowMs = FRAME_WINDOW_MS,
): number[] {
  const cutoff = now - windowMs;
  let start = 0;
  while (start < timestamps.length && timestamps[start]! < cutoff) start++;
  return start === 0 ? timestamps : timestamps.slice(start);
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                */
/* -------------------------------------------------------------------------- */

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** `1280 × 720`, or `unknown` when the size is not known. */
export function formatResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (!isPositive(width) || !isPositive(height)) return 'unknown';
  return `${Math.round(width)} × ${Math.round(height)}`;
}

/** `30.0 fps`, or `unknown` when a rate could not be measured. */
export function formatFps(fps: number | null | undefined): string {
  if (!isPositive(fps)) return 'unknown';
  return `${fps.toFixed(1)} fps`;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** `16:9`, or a decimal ratio when the reduced form is unwieldy. */
export function formatAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): string | null {
  if (!isPositive(width) || !isPositive(height)) return null;
  const w = Math.round(width);
  const h = Math.round(height);
  const divisor = gcd(w, h);
  const reducedW = w / divisor;
  const reducedH = h / divisor;
  if (reducedW <= 32 && reducedH <= 32) return `${reducedW}:${reducedH}`;
  return `${(w / h).toFixed(2)}:1`;
}

/** Human wording for a `facingMode` track setting. */
export function facingLabel(mode: string | null | undefined): string | null {
  if (!mode) return null;
  switch (mode) {
    case 'user':
      return 'Front (user-facing)';
    case 'environment':
      return 'Rear (environment-facing)';
    case 'left':
    case 'right':
      return `${mode[0]!.toUpperCase()}${mode.slice(1)} side`;
    default:
      return mode;
  }
}

/* -------------------------------------------------------------------------- */
/*  Snapshot                                                                  */
/* -------------------------------------------------------------------------- */

export type SnapshotFormat = 'png' | 'jpeg';

export interface SnapshotDimensions {
  width: number;
  height: number;
  format: SnapshotFormat;
}

export interface SnapshotInfo extends SnapshotDimensions {
  bytes: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function pngDimensions(bytes: Uint8Array): SnapshotDimensions | null {
  if (bytes.length < 24) return null;
  if (!PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) return null;
  // IHDR must be the first chunk: 4-byte length, 4-byte type, then width/height.
  if (String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) !== 'IHDR') return null;
  const width = readU32BE(bytes, 16);
  const height = readU32BE(bytes, 20);
  if (!width || !height) return null;
  return { width, height, format: 'png' };
}

/** Start-of-frame markers: every SOFn except the DHT/JPG/DAC codes (0xc4/c8/cc). */
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegDimensions(bytes: Uint8Array): SnapshotDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1; // resync after a stray byte
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    offset += 2;
    // Standalone markers carry no payload.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    // End of image, or the entropy-coded scan (which has no fixed length).
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 1 >= bytes.length) return null;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return null;
    if (SOF_MARKERS.has(marker)) {
      if (length < 7) return null;
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      if (!width || !height) return null;
      return { width, height, format: 'jpeg' };
    }
    offset += length;
  }
  return null;
}

/**
 * Read the pixel size straight out of the container header — no decoding, no
 * canvas, so it works in a worker and in a test.
 */
export function readImageDimensions(bytes: Uint8Array): SnapshotDimensions | null {
  return pngDimensions(bytes) ?? jpegDimensions(bytes);
}

/** Reject a snapshot whose size cannot be trusted (empty, absurd or hostile). */
export function assertSnapshotDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new ToolError(
      `The snapshot has no readable size (${width} × ${height}).`,
      'Take the snapshot again from the camera panel.',
    );
  }
  if (width > MAX_SNAPSHOT_EDGE || height > MAX_SNAPSHOT_EDGE) {
    throw new ToolError(
      `The snapshot is ${formatResolution(width, height)} — larger than this tool supports.`,
      `Frames up to ${MAX_SNAPSHOT_EDGE} px per side are supported.`,
    );
  }
  if (width * height > MAX_SNAPSHOT_PIXELS) {
    throw new ToolError(
      `The snapshot is ${width * height} pixels — larger than this tool supports.`,
      `Frames up to ${MAX_SNAPSHOT_PIXELS / 1_000_000} megapixels are supported.`,
    );
  }
}

/** True when the live stream and the captured frame describe the same size. */
export function sameResolution(
  streamWidth: number | null | undefined,
  streamHeight: number | null | undefined,
  snapshotWidth: number,
  snapshotHeight: number,
): boolean {
  if (!isPositive(streamWidth) || !isPositive(streamHeight)) return true; // nothing to compare against
  return Math.round(streamWidth) === snapshotWidth && Math.round(streamHeight) === snapshotHeight;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * `face-time-hd-camera-webcam-snapshot-20261024-093000.png` — the camera name
 * makes a folder of test snapshots self-describing, and the timestamp keeps two
 * captures apart.
 */
export function snapshotFilename(label: string, at: Date, extension = 'png'): string {
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(
    at.getHours(),
  )}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  const slug = label
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  const parts = [slug, 'webcam-snapshot', stamp].filter(Boolean);
  return `${parts.join('-')}.${extension.replace(/^\./, '')}`;
}

/* -------------------------------------------------------------------------- */
/*  Report                                                                    */
/* -------------------------------------------------------------------------- */

/** The report table shown to the user: everything the test measured. */
export function buildReportRows(probe: CaptureProbe, snapshot: SnapshotInfo): string[][] {
  const rows: string[][] = [];
  const { settings } = probe;

  rows.push(['Camera', probe.deviceLabel || 'Unknown camera']);
  rows.push(['Device ID', probe.deviceId || '(hidden until camera access is allowed)']);
  rows.push(['Live resolution', formatResolution(settings.width, settings.height)]);
  const ratio = formatAspectRatio(settings.width, settings.height);
  if (ratio) rows.push(['Aspect ratio', ratio]);
  if (isPositive(settings.frameRate)) {
    rows.push(['Frame rate reported by the camera', formatFps(settings.frameRate)]);
  }
  rows.push([
    'Measured frame rate',
    probe.frames >= 2
      ? `${formatFps(probe.fps)} (${pluralize(probe.frames, 'frame')} over ${formatDuration(
          probe.sampleMs,
        )})`
      : 'not measured',
  ]);
  const facing = facingLabel(settings.facingMode);
  if (facing) rows.push(['Facing', facing]);
  rows.push([
    'Snapshot',
    `${formatResolution(snapshot.width, snapshot.height)} ${snapshot.format.toUpperCase()} · ${formatBytes(
      snapshot.bytes,
    )}`,
  ]);

  const devices = probe.devices ?? [];
  rows.push(['Cameras detected', String(devices.length)]);
  devices.forEach((device, index) => {
    const name = device.label || '(label hidden until camera access is allowed)';
    rows.push([`Camera ${index + 1}`, device.active ? `${name} — in use` : name]);
  });
  return rows;
}

/** The notes and warnings that go with a report. */
export function buildReportNotes(probe: CaptureProbe, snapshot: SnapshotInfo): {
  notes: string[];
  warnings: string[];
} {
  const notes: string[] = [];
  const warnings: string[] = [];

  if (!sameResolution(probe.settings.width, probe.settings.height, snapshot.width, snapshot.height)) {
    warnings.push(
      `The live stream reported ${formatResolution(
        probe.settings.width,
        probe.settings.height,
      )} but the captured frame is ${formatResolution(snapshot.width, snapshot.height)}.`,
    );
  }
  if (probe.frames >= 1 && probe.frames < 2) {
    notes.push('The frame rate could not be measured — fewer than two frames were seen.');
  }
  if (probe.fpsSource === 'raf') {
    notes.push(
      'This browser has no video-frame callback, so the frame rate was sampled from the display refresh loop and may differ from the rate the camera actually delivers.',
    );
  }
  if (!probe.deviceId && probe.devices === null) {
    notes.push('No live camera readings were supplied, so this report only describes the snapshot.');
  }
  notes.push('The frame was captured and measured in this tab — nothing was recorded or uploaded.');
  return { notes, warnings };
}

/* -------------------------------------------------------------------------- */
/*  Friendly errors                                                           */
/* -------------------------------------------------------------------------- */

/** Turn a `getUserMedia` / camera failure into a user-facing `ToolError`. */
export function describeCameraError(err: unknown): ToolError {
  const e = err as { name?: string; message?: string } | undefined;
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new ToolError(
        'Camera permission was denied.',
        'Allow camera access for this site — open the padlock in the address bar, set Camera to “Allow”, then press Start camera again.',
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new ToolError(
        'No camera was found on this device.',
        'Connect a webcam and check that it is not disabled in your system settings, then press Start camera again.',
      );
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new ToolError(
        'The camera is already in use.',
        'Close other apps or tabs that are using the camera (video calls, other tabs), then press Start camera again.',
      );
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return new ToolError(
        'This camera does not support the requested settings.',
        'Press Start camera again to retry with the default camera.',
      );
    case 'SecurityError':
      return new ToolError(
        'Camera access is blocked on this page.',
        'Browsers only allow cameras on secure pages — open this tool over https:// (or localhost), then try again.',
      );
    case 'TypeError':
      return new ToolError(
        'This browser does not expose a camera API.',
        'Camera access needs a recent Chrome, Edge, Firefox or Safari.',
      );
    default:
      return new ToolError(
        e?.message || 'The camera could not be started.',
        'Check that a camera is connected and not in use by another app, then press Start camera again.',
      );
  }
}

/** Guard the “press Start with no camera attached” case with a clear message. */
export function assertHasDevices(devices: readonly CameraDevice[]): void {
  if (devices.length === 0) {
    throw new ToolError(
      'No camera was found on this device.',
      'Connect a webcam, then reload this page. If one is already attached, check that the browser is allowed to use it in your system settings.',
    );
  }
}
