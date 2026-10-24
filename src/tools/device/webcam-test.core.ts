/**
 * Pure logic behind the webcam test tool.
 *
 * The panel (`src/components/panels/webcam-test-panel.ts`) owns everything
 * that touches the DOM and the camera. This module only parses what the panel
 * measured and turns it into the report the page shows, so it can be unit
 * tested without a browser.
 *
 * The panel hands the tool a JSON document with this shape:
 *
 * ```json
 * {
 *   "state": "live",
 *   "cameraLabel": "FaceTime HD Camera",
 *   "width": 1280,
 *   "height": 720,
 *   "reportedFps": 30,
 *   "measuredFps": 29.8,
 *   "hasAudio": false,
 *   "cameras": [{ "deviceId": "abc", "label": "FaceTime HD Camera" }],
 *   "settings": { "width": 1280, "height": 720, "frameRate": 30 },
 *   "errorMessage": null
 * }
 * ```
 *
 * Nothing here reaches the network or the camera — the report is built from
 * the numbers the panel already measured.
 */
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** The panel never sends more than this; a bigger payload is a bug or an attack. */
export const MAX_INPUT_CHARS = 100_000;
/** Practical per-side pixel limit shared by browsers. */
export const MAX_DIMENSION = 16_384;
/** Above this a frame rate is nonsense, not a camera. */
export const MAX_FPS = 1_000;
/** A browser with more cameras than this is a broken enumeration. */
export const MAX_CAMERAS = 64;

/* -------------------------------------------------------------------------- */
/*  States                                                                     */
/* -------------------------------------------------------------------------- */

/** The panel reports exactly one of these states. */
export const WEBCAM_STATES = [
  'live',
  'stopped',
  'denied',
  'no-camera',
  'in-use',
  'unsupported',
  'failed',
] as const;

export type WebcamState = (typeof WEBCAM_STATES)[number];

/** How each state reads in the report. */
export const STATE_LABELS: Record<WebcamState, string> = {
  live: 'Camera running',
  stopped: 'Camera off',
  denied: 'Permission denied',
  'no-camera': 'No camera found',
  'in-use': 'Camera already in use',
  unsupported: 'No camera API in this browser',
  failed: 'The camera could not be started',
};

/* -------------------------------------------------------------------------- */
/*  Resolutions                                                                */
/* -------------------------------------------------------------------------- */

/** The capture sizes the panel can ask for. `auto` lets the browser decide. */
export const RESOLUTION_CHOICES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Browser default' },
  { value: '640', label: '640 × 360' },
  { value: '1280', label: '1280 × 720' },
  { value: '1920', label: '1920 × 1080' },
];

/** The values `resolution` accepts. */
export const RESOLUTION_VALUES = RESOLUTION_CHOICES.map((choice) => choice.value);

/**
 * The ideal capture size for a resolution request, or `null` for the browser
 * default. Throws for an unknown value so a typo never reaches `getUserMedia`.
 */
export function resolutionConstraint(value: string): { width: number; height: number } | null {
  switch (value) {
    case 'auto':
      return null;
    case '640':
      return { width: 640, height: 360 };
    case '1280':
      return { width: 1280, height: 720 };
    case '1920':
      return { width: 1920, height: 1080 };
    default:
      throw new ToolError(
        `Unknown resolution "${value}".`,
        `Choose one of: ${RESOLUTION_VALUES.join(', ')}.`,
      );
  }
}

/** The human label of a resolution request. */
export function resolutionLabel(value: string): string {
  return RESOLUTION_CHOICES.find((choice) => choice.value === value)?.label ?? value;
}

/* -------------------------------------------------------------------------- */
/*  Facts                                                                      */
/* -------------------------------------------------------------------------- */

/** One camera the browser knows about. */
export interface CameraDevice {
  /** The browser's opaque id for the camera. */
  deviceId: string;
  /** The camera's name — empty until the user grants permission. */
  label: string;
}

/** Everything the panel measured, already validated. */
export interface WebcamFacts {
  state: WebcamState;
  /** Name of the camera in use. */
  cameraLabel: string;
  /** Actual capture width in pixels, from `track.getSettings()`. */
  width: number | null;
  /** Actual capture height in pixels, from `track.getSettings()`. */
  height: number | null;
  /** Frame rate the track claims to deliver. */
  reportedFps: number | null;
  /** Frame rate actually measured over the preview window. */
  measuredFps: number | null;
  /** True when an audio track is live. */
  hasAudio: boolean;
  /** Every camera the browser enumerated. */
  cameras: CameraDevice[];
  /** The raw `track.getSettings()` object, when there is one. */
  settings: Record<string, unknown> | null;
  /** A friendly message for the failure, when there is one. */
  errorMessage: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Parsing                                                                    */
/* -------------------------------------------------------------------------- */

function readString(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') {
    throw new ToolError(`"${key}" must be a string.`, `Received ${typeof value} instead.`);
  }
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new ToolError(`"${key}" must be true or false.`, `Received ${typeof value} instead.`);
  }
  return value;
}

interface NumberBounds {
  min: number;
  max: number;
  label: string;
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  bounds: NumberBounds,
): number | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolError(
      `"${key}" must be a finite number.`,
      `Received ${typeof value === 'number' ? String(value) : typeof value} instead.`,
    );
  }
  if (value < bounds.min || value > bounds.max) {
    throw new ToolError(
      `"${key}" is out of range (${value}).`,
      `A ${bounds.label} must be between ${bounds.min} and ${bounds.max}.`,
    );
  }
  return value;
}

function readCameras(source: Record<string, unknown>): CameraDevice[] {
  const value = source['cameras'];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ToolError('"cameras" must be an array.', 'Received something else instead.');
  }
  if (value.length > MAX_CAMERAS) {
    throw new ToolError(
      `Too many cameras listed (${value.length}).`,
      `At most ${MAX_CAMERAS} cameras are accepted.`,
    );
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ToolError(
        `Camera #${index + 1} must be an object.`,
        'Each camera needs a "deviceId" and a "label".',
      );
    }
    const record = entry as Record<string, unknown>;
    return {
      deviceId: readString(record, 'deviceId'),
      label: readString(record, 'label'),
    };
  });
}

function readSettings(source: Record<string, unknown>): Record<string, unknown> | null {
  const value = source['settings'];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ToolError(
      '"settings" must be an object.',
      'It holds the raw values from track.getSettings().',
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Parse and validate the JSON the panel sent.
 *
 * Every failure is a `ToolError`: a report built from half-understood numbers
 * would be worse than no report at all.
 */
export function parseWebcamFacts(text: string): WebcamFacts {
  if (typeof text !== 'string') {
    throw new ToolError('No camera details were provided.');
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ToolError(
      'No camera details were provided.',
      'Start the camera in the panel above — the report is built from what it measures.',
    );
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new ToolError(
      `The camera details are too large (${trimmed.length.toLocaleString()} characters).`,
      `The limit is ${MAX_INPUT_CHARS.toLocaleString()} characters.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ToolError(
      'The camera details are not valid JSON.',
      'This is a bug in the panel — reload the page and try again.',
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError(
      'The camera details must be a JSON object.',
      'Expected an object with at least a "state" field.',
    );
  }

  const source = parsed as Record<string, unknown>;

  const rawState = source['state'];
  if (typeof rawState !== 'string' || !WEBCAM_STATES.includes(rawState as WebcamState)) {
    throw new ToolError(
      typeof rawState === 'string'
        ? `Unknown camera state "${rawState}".`
        : 'The camera details are missing a "state" field.',
      `Expected one of: ${WEBCAM_STATES.join(', ')}.`,
    );
  }
  const state = rawState as WebcamState;

  const width = readNumber(source, 'width', { min: 1, max: MAX_DIMENSION, label: 'width' });
  const height = readNumber(source, 'height', { min: 1, max: MAX_DIMENSION, label: 'height' });
  const reportedFps = readNumber(source, 'reportedFps', {
    min: 0,
    max: MAX_FPS,
    label: 'frame rate',
  });
  const measuredFps = readNumber(source, 'measuredFps', {
    min: 0,
    max: MAX_FPS,
    label: 'frame rate',
  });

  if (state === 'live' && (width === null || height === null)) {
    throw new ToolError(
      'The live report is missing the capture resolution.',
      'Both "width" and "height" are required while the camera is running.',
    );
  }

  return {
    state,
    cameraLabel: readString(source, 'cameraLabel'),
    width,
    height,
    reportedFps,
    measuredFps,
    hasAudio: readBoolean(source, 'hasAudio', false),
    cameras: readCameras(source),
    settings: readSettings(source),
    errorMessage: readString(source, 'errorMessage') || null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Numbers                                                                    */
/* -------------------------------------------------------------------------- */

/** Frames per second over a window. Zero for an empty or nonsensical window. */
export function framesPerSecond(frames: number, elapsedMs: number): number {
  if (!Number.isFinite(frames) || frames <= 0) return 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return (frames * 1000) / elapsedMs;
}

/** Round a frame rate to `decimals` places — 29.97 becomes 30, not 29.969999. */
export function roundFps(fps: number, decimals = 1): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  const factor = 10 ** decimals;
  return Math.round(fps * factor) / factor;
}

/** How far the measured frame rate is from the one the track claims. */
export function fpsDiscrepancy(reported: number | null, measured: number | null): number | null {
  if (reported === null || measured === null) return null;
  return Math.abs(reported - measured);
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** `1920 × 1080 px`, or a dash when the size is unknown. */
export function formatResolution(width: number | null, height: number | null): string {
  if (width === null || height === null) return '—';
  return `${width} × ${height} px`;
}

/** The name to show for a camera — never an empty cell. */
export function displayLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.length ? trimmed : 'Unnamed camera';
}

/** A one-line summary of the camera list the browser reported. */
export function summariseCameraList(cameras: CameraDevice[]): string {
  if (!cameras.length) return 'No cameras detected';
  const named = cameras.filter((camera) => camera.label.trim().length > 0).length;
  const count = `${cameras.length} camera${cameras.length === 1 ? '' : 's'}`;
  if (named === 0) return `${count} detected (names hidden until you allow access)`;
  if (named < cameras.length) return `${count} detected (${named} named)`;
  return count;
}

/** The frame-rate cell: what the track claims, and what was really delivered. */
export function formatFrameRate(facts: WebcamFacts): string {
  const parts: string[] = [];
  if (facts.reportedFps !== null) parts.push(`${roundFps(facts.reportedFps)} fps reported`);
  if (facts.measuredFps !== null) parts.push(`${roundFps(facts.measuredFps)} fps measured`);
  if (!parts.length) return '—';
  return parts.join(' · ');
}

/** A warning when the preview delivered noticeably fewer frames than promised. */
export function fpsWarning(facts: WebcamFacts, tolerance = 2): string | null {
  const difference = fpsDiscrepancy(facts.reportedFps, facts.measuredFps);
  if (difference === null || difference <= tolerance) return null;
  return `The camera reports ${roundFps(facts.reportedFps!)} fps but the preview delivered about ${roundFps(
    facts.measuredFps!,
  )} fps — the browser is likely dropping frames.`;
}

/* -------------------------------------------------------------------------- */
/*  The report                                                                 */
/* -------------------------------------------------------------------------- */

/** How the report should be built. */
export interface ReportOptions {
  /** The resolution the panel asked for. */
  requested: string;
  /** Whether the raw track settings are included. */
  includeSettings: boolean;
}

/** The report rows, ready for the shared table renderer. */
export function buildReportRows(facts: WebcamFacts, options: ReportOptions): string[][] {
  const rows: string[][] = [['Status', STATE_LABELS[facts.state]]];

  if (facts.state === 'live') {
    rows.push(['Camera', displayLabel(facts.cameraLabel)]);
    rows.push(['Resolution', formatResolution(facts.width, facts.height)]);
    rows.push(['Frame rate', formatFrameRate(facts)]);
    rows.push(['Audio', facts.hasAudio ? 'Yes — an audio track is live' : 'No — video only']);
  }

  rows.push(['Cameras detected', summariseCameraList(facts.cameras)]);
  rows.push(['Requested resolution', resolutionLabel(options.requested)]);

  if (facts.errorMessage) rows.push(['Details', facts.errorMessage]);

  if (options.includeSettings && facts.settings) {
    rows.push(['Track settings', JSON.stringify(facts.settings)]);
  }

  return rows;
}

/** The key numbers, for the summary under the table. */
export function buildStats(facts: WebcamFacts): Record<string, string | number> {
  const stats: Record<string, string | number> = {
    state: facts.state,
    cameras: facts.cameras.length,
    audio: facts.hasAudio ? 'yes' : 'no',
  };
  if (facts.width !== null) stats['width'] = facts.width;
  if (facts.height !== null) stats['height'] = facts.height;
  const fps = facts.measuredFps ?? facts.reportedFps;
  if (fps !== null) stats['fps'] = roundFps(fps);
  if (facts.measuredFps !== null) stats['measured fps'] = roundFps(facts.measuredFps);
  return stats;
}

/** The short explanation under the report. */
export function buildNotes(facts: WebcamFacts): string[] {
  const notes = [
    'Measured in this tab — no frame left your device and nothing was recorded or stored.',
  ];
  switch (facts.state) {
    case 'stopped':
      notes.push('The camera was stopped — start it again to measure the camera.');
      break;
    case 'denied':
      notes.push('Allow camera access for this site, then start the camera again.');
      break;
    case 'no-camera':
      notes.push(
        'Connect a camera (and check that it is not disabled in system settings), then try again.',
      );
      break;
    case 'in-use':
      notes.push('Close the other app or tab holding the camera, then start it again.');
      break;
    case 'unsupported':
      notes.push('Camera access needs a recent Chrome, Edge, Firefox or Safari.');
      break;
    case 'failed':
      notes.push('Try a different camera, or start the camera again.');
      break;
    default:
      break;
  }
  return notes;
}
