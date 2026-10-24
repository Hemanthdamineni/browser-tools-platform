/**
 * Pure helpers for the video → still frames tool.
 *
 * Everything here is a deterministic function of the options and the source
 * clip: which timestamps to sample, whether the frames ship as individual PNGs
 * or as a contact sheet, the contact-sheet grid maths and the output names.
 * Keeping it in its own module (with no browser codec, no canvas) means every
 * branch — interval vs count, the frame cap, the grid — is unit-testable.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Slowest useful interval between frames (0.1 s). */
export const FRAMES_MIN_INTERVAL = 0.1;
/** Shortest useful extractable slice. */
export const FRAMES_MIN_RANGE = FRAMES_MIN_INTERVAL;
/**
 * Hard ceiling on the number of frames we will decode. Each one is a full
 * decode + a PNG encode, so beyond this a long clip would wedge the tab.
 */
export const FRAMES_MAX = 200;
/** Widest individual frame we allow (a 1280 px still is plenty for screenshots). */
export const FRAMES_MAX_WIDTH = 2560;
/** Narrowest useful still. */
export const FRAMES_MIN_WIDTH = 16;

/** Gap between thumbnails on a contact sheet, in pixels. */
export const SHEET_GAP = 8;
/** Padding around the whole contact sheet, in pixels. */
export const SHEET_PADDING = 12;
/** Preferred width of one contact-sheet thumbnail. */
export const SHEET_THUMB_WIDTH = 320;
/** Default contact-sheet columns (0 means "pick to look square"). */
export const SHEET_AUTO_COLUMNS = 0;
/**
 * Above this a still is still downloaded but its inline thumbnail is skipped,
 * so a run of 200 large frames cannot flood the page with data URLs.
 */
export const FRAMES_MAX_PREVIEW_BYTES = 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*  Modes                                                                      */
/* -------------------------------------------------------------------------- */

export type FrameMode = 'interval' | 'count';
export type FrameLayout = 'individual' | 'sheet';

/**
 * Turn the `mode` option into a typed value click, failing loudly on anything
 * that is not a mode we know.
 */
export function resolveFrameMode(value: unknown): FrameMode {
  if (value === 'interval' || value === 'count') return value;
  throw new ToolError('Unknown frame mode.', 'Pick “every N seconds” or “N evenly spaced frames”.');
}

/** Turn the `layout` option into a typed value, failing loudly on an unknown one. */
export function resolveFrameLayout(value: unknown): FrameLayout {
  if (value === 'individual' || value === 'sheet') return value;
  throw new ToolError('Unknown layout.', 'Pick “individual images” or “a contact sheet”.');
}

/* -------------------------------------------------------------------------- */
/*  Timestamps                                                                 */
/* -------------------------------------------------------------------------- */

/** Read a positive number option, treating 0 / absent as `fallback`. */
function readPositive(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new ToolError(`${label} must be a positive number.`);
  }
  return n === 0 ? fallback : n;
}

function readWhole(value: unknown, fallback: number, label: string, min: number): number {
  const n = readPositive(value, fallback, label);
  const whole = Math.round(n);
  if (whole < min) throw new ToolError(`${label} must be at least ${min}.`);
  return whole;
}

/**
 * Sample the `[start, end]` range of a clip every `interval` seconds.
 * The first frame sits on `start`; the last never passes `end`.
 *
 * Generation stops after {@link FRAMES_MAX} + 1 entries, which is all the
 * caller needs to know the plan is over the cap — it never walks a huge range.
 */
export function planIntervalTimestamps(
  start: number,
  end: number,
  interval: number,
): number[] {
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new ToolError('The interval must be greater than zero.');
  }
  const step = Math.max(interval, FRAMES_MIN_INTERVAL);
  const out: number[] = [];
  for (let t = start; t <= end + 1e-9; t += step) {
    out.push(roundTimestamp(t));
    if (out.length > FRAMES_MAX) break;
  }
  if (out.length === 0) out.push(roundTimestamp(start));
  return out;
}

/**
 * Sample `count` timestamps evenly across the `[start, end]` range. The first
 * and last frames sit exactly on the range bounds.
 */
export function planCountTimestamps(
  start: number,
  end: number,
  count: number,
): number[] {
  const whole = Math.max(1, Math.round(count));
  const span = Math.max(0, end - start);
  if (span <= 0 || whole === 1) return [roundTimestamp(start)];
  const out: number[] = [];
  for (let i = 0; i < whole; i++) {
    out.push(roundTimestamp(start + (span * i) / (whole - 1)));
  }
  return out;
}

/** Round a timestamp to the microsecond so equal steps never drift apart. */
export function roundTimestamp(seconds: number): number {
  return Math.round(seconds * 1e6) / 1e6;
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** What we know about the source clip before the plan is built. */
export interface FramesSourceInfo {
  /** Container duration in seconds, or `null` when it could not be read. */
  durationSeconds: number | null;
  /** Display size of the video track. */
  sourceWidth: number;
  sourceHeight: number;
}

/** The concrete plan for the run, with every decision already made. */
export interface FramesSettings {
  mode: FrameMode;
  layout: FrameLayout;
  startSeconds: number;
  endSeconds: number;
  /** Timestamps (seconds, on the clip's timeline) to decode. */
  timestamps: number[];
  /** Width of each still (individual frames and sheet thumbnails alike). */
  width: number;
  /** Height that preserves the source aspect ratio at `width`. */
  height: number;
  /** For `sheet` layout only: the grid + canvas dimensions. */
  sheet: SheetGrid | null;
}

export interface SheetGrid {
  columns: number;
  rows: number;
  thumbWidth: number;
  thumbHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Space between two thumbnails, in pixels. */
  gap: number;
  /** Margin around the whole sheet, in pixels. */
  padding: number;
}

function readTimeRange(
  options: Record<string, string | number | boolean | undefined>,
  duration: number | null,
): { start: number; end: number } {
  const start = readPositive(options.start, 0, 'Start time');
  let end = readPositive(options.end, 0, 'End time');
  if (duration != null && duration > 0) {
    if (end === 0) end = duration;
    if (end > duration) end = duration;
    if (start > end) {
      throw new ToolError('The start time is after the end time.');
    }
  } else if (end === 0) {
    throw new ToolError(
      'The clip length could not be read, so pick an explicit end time.',
      'Give the video a range to sample, e.g. start 0 and end 10.',
    );
  }
  return { start, end };
}

/**
 * Keep the source aspect ratio when a frame is scaled to `width`.
 */
export function fitSize(
  width: number,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const ratio = sourceWidth > 0 && sourceHeight > 0 ? sourceHeight / sourceWidth : 1;
  return { width: w, height: Math.max(1, Math.round(w * ratio)) };
}

/**
 * Decide how many columns a contact sheet uses, then lay the cells out.
 */
export function sheetGrid(
  frameCount: number,
  columns: number,
  thumbWidth: number,
  thumbHeight: number,
): SheetGrid {
  const count = Math.max(1, frameCount);
  const cols = columns > 0 ? columns : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const canvasWidth = SHEET_PADDING * 2 + cols * thumbWidth + Math.max(0, cols - 1) * SHEET_GAP;
  const canvasHeight = SHEET_PADDING * 2 + rows * thumbHeight + Math.max(0, rows - 1) * SHEET_GAP;
  return {
    columns: cols,
    rows,
    thumbWidth,
    thumbHeight,
    canvasWidth,
    canvasHeight,
    gap: SHEET_GAP,
    padding: SHEET_PADDING,
  };
}

/**
 * Where the `index`-th thumbnail sits on the sheet. The cell is always the
 * thumbnail size; the caller draws the frame into it.
 */
export function sheetCell(
  index: number,
  grid: SheetGrid,
): { x: number; y: number; width: number; height: number } {
  const col = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return {
    x: grid.padding + col * (grid.thumbWidth + grid.gap),
    y: grid.padding + row * (grid.thumbHeight + grid.gap),
    width: grid.thumbWidth,
    height: grid.thumbHeight,
  };
}

/**
 * Validate the user's options and turn them into a concrete plan. This is the
 * only entry point the tool uses, so a bad option fails before any frame is
 * decoded.
 */
export function resolveFramesSettings(
  options: Record<string, string | number | boolean | undefined>,
  source: FramesSourceInfo,
): FramesSettings {
  const mode = resolveFrameMode(options.mode);
  const layout = resolveFrameLayout(options.layout);
  const { start, end } = readTimeRange(options, source.durationSeconds);

  let timestamps: number[];
  if (mode === 'interval') {
    const interval = readPositive(options.interval, 1, 'Interval');
    timestamps = planIntervalTimestamps(start, end, interval);
  } else {
    const count = readWhole(options.count, 12, 'Number of frames', 1);
    timestamps = planCountTimestamps(start, end, count);
  }

  if (timestamps.length > FRAMES_MAX) {
    throw new ToolError(
      `That range would extract ${timestamps.length} frames — over the ${FRAMES_MAX} frame limit.`,
      'Pick a longer interval, fewer frames, or a shorter range.',
    );
  }
  if (!timestamps.length) {
    throw new ToolError('The chosen range produced no frames to extract.');
  }

  const baseWidth = layout === 'sheet' ? SHEET_THUMB_WIDTH : 480;
  const requestedWidth = readPositive(options.width, baseWidth, 'Width');
  const width = Math.min(Math.max(Math.round(requestedWidth), FRAMES_MIN_WIDTH), FRAMES_MAX_WIDTH);
  const { width: w, height: h } = fitSize(width, source.sourceWidth, source.sourceHeight);

  let sheet: SheetGrid | null = null;
  if (layout === 'sheet') {
    const columns = readWhole(options.columns, SHEET_AUTO_COLUMNS, 'Columns', 0);
    sheet = sheetGrid(timestamps.length, columns, w, h);
  }

  return { mode, layout, startSeconds: start, endSeconds: end, timestamps, width: w, height: h, sheet };
}

/* -------------------------------------------------------------------------- */
/*  File names                                                                 */
/* -------------------------------------------------------------------------- */

/** Strip the extension and neutralise path separators for a base name. */
function baseName(sourceName: string): string {
  return sourceName.replace(/\.[^./\\]+$/, '').replace(/[\\/]+/g, '-').trim();
}

/**
 * `holiday clip.mp4`, index 3 of 12 → `holiday clip-03.png`.
 * The index is zero-padded to the width of the total so downloads sort in order.
 */
export function frameOutputFilename(sourceName: string, index: number, total: number): string {
  const width = Math.max(2, String(Math.max(1, total)).length);
  const n = String(index + 1).padStart(width, '0');
  return `${baseName(sourceName)}-${n}.png`;
}

/** `holiday clip.mp4` → `holiday clip-contact-sheet.png`. */
export function sheetOutputFilename(sourceName: string): string {
  return `${baseName(sourceName)}-contact-sheet.png`;
}

/** A short human label for the chosen sampling mode. */
export function samplingLabel(mode: FrameMode, timestamps: number[], interval: number): string {
  if (mode === 'count') return `${timestamps.length} evenly spaced frames`;
  return `Every ${interval} s · ${timestamps.length} frames`;
}