/**
 * Pure helpers for the video → GIF tool.
 *
 * Nothing in this module touches the DOM, the network, a canvas or a codec:
 * every export is a plain computation over numbers and byte arrays, so the
 * whole thing is unit-testable in Node/jsdom. The browser-only parts
 * (demuxing, decoding, drawing) live in `video-to-gif.tool.ts`.
 *
 * The GIF container itself is written by `gifenc` (MIT); the palette
 * quantiser, the dither and the frame selection are implemented here so the
 * quality knobs behave predictably and stay testable.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Slowest frame rate a GIF can usefully carry. */
export const GIF_MIN_FPS = 1;
/** Fastest frame rate we encode — beyond this a GIF is pointless and huge. */
export const GIF_MAX_FPS = 30;
/** Narrowest output we allow. */
export const GIF_MIN_WIDTH = 16;
/** Widest output we allow. */
export const GIF_MAX_WIDTH = 1280;
/** Hard ceiling on encoded frames, so a long clip can never wedge the tab. */
export const GIF_MAX_FRAMES = 300;
/** Hard ceiling on the encoded GIF size (16 MB). */
export const GIF_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
/** Above this the inline preview data URL is skipped (the file is still saved). */
export const GIF_MAX_PREVIEW_BYTES = 4 * 1024 * 1024;
/** Above this the small thumbnail next to the download is skipped. */
export const GIF_MAX_THUMBNAIL_BYTES = 1024 * 1024;
/** Largest number of pixels a single GIF frame may have. */
export const GIF_MAX_FRAME_PIXELS = 2_000_000;

/* -------------------------------------------------------------------------- */
/*  Palette quality                                                            */
/* -------------------------------------------------------------------------- */

export type PaletteScope = 'global' | 'local';

export interface PalettePreset {
  id: string;
  /** Shown in the option picker. */
  label: string;
  /** Maximum number of colours in the palette. */
  colors: number;
  /** `global` = one palette shared by every frame, `local` = one per frame. */
  scope: PaletteScope;
  /** Whether frames are dithered (Floyd–Steinberg) before quantisation. */
  dither: boolean;
  /** One-line explanation shown in the FAQ. */
  description: string;
}

/**
 * The three palette presets. The knob trades file size against fidelity:
 * fewer colours and a shared palette compress best, more colours and dithering
 * look best.
 */
export const PALETTE_PRESETS: readonly PalettePreset[] = [
  {
    id: 'small',
    label: 'Small file — 32 colours, one shared palette',
    colors: 32,
    scope: 'global',
    dither: false,
    description: 'One 32-colour palette shared by every frame. Smallest file, bandiest gradients.',
  },
  {
    id: 'balanced',
    label: 'Balanced — 128 colours, a palette per frame',
    colors: 128,
    scope: 'local',
    dither: false,
    description: 'A 128-colour palette for every frame. Good colour fidelity, moderate file size.',
  },
  {
    id: 'high',
    label: 'Best quality — 256 colours, dithered',
    colors: 256,
    scope: 'local',
    dither: true,
    description:
      'A 256-colour palette for every frame with Floyd–Steinberg dithering. Smoothest gradients, largest file.',
  },
];

/** Look up a palette preset, failing loudly on an unknown value. */
export function palettePreset(value: unknown): PalettePreset {
  const id = String(value ?? 'balanced');
  const preset = PALETTE_PRESETS.find((p) => p.id === id);
  if (!preset) {
    throw new ToolError(
      `“${id}” is not a known palette quality.`,
      `Choose one of: ${PALETTE_PRESETS.map((p) => p.id).join(', ')}.`,
    );
  }
  return preset;
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** What we know about the source clip before we can plan the GIF. */
export interface GifSourceInfo {
  /** Container duration in seconds, or `null` when it could not be read. */
  durationSeconds: number | null;
  /** Display width of the video track (after rotation). */
  sourceWidth: number;
  /** Display height of the video track (after rotation). */
  sourceHeight: number;
}

export interface GifSettings {
  /** First second of the clip that ends up in the GIF. */
  startSeconds: number;
  /** Last second of the clip that ends up in the GIF (exclusive). */
  endSeconds: number;
  /** Length of the selected range. */
  rangeSeconds: number;
  /** Requested frame rate. */
  fps: number;
  /** Frame delay in milliseconds (GIF stores centiseconds). */
  delayMs: number;
  /** Frame rate the delay actually plays back at. */
  effectiveFps: number;
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels (aspect ratio preserved). */
  height: number;
  /** Number of frames the GIF will contain. */
  frameCount: number;
  /** Maximum number of palette colours. */
  colors: number;
  /** Whether the palette is shared or per frame. */
  paletteScope: PaletteScope;
  /** Whether frames are dithered. */
  dither: boolean;
}

/**
 * Read a numeric option.
 *
 * An empty value means "use the default" — the shared form submits an empty
 * string for a field the user cleared. Anything else that is not a number is
 * an error: silently falling back to the default would hand the user a GIF
 * they did not ask for.
 */
function readNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') {
    throw new ToolError(`${label} must be a number.`, `Enter a number, not “${String(value)}”.`);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return fallback;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new ToolError(
        `${label} must be a number.`,
        `“${trimmed}” is not a number — enter a value such as 10.`,
      );
    }
    return parsed;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolError(`${label} must be a number.`, 'Enter a number, such as 10.');
  }
  return value;
}

/**
 * Validate the user's options and turn them into a concrete plan.
 *
 * Every failure is a `ToolError` with a human hint: an out-of-range time
 * range, a frame rate of zero, a width of zero and so on must never silently
 * produce a wrong GIF.
 */
export function resolveGifSettings(
  options: Record<string, string | number | boolean | undefined>,
  source: GifSourceInfo,
): GifSettings {
  const preset = palettePreset(options.palette);

  const fps = readNumber(options.fps, 10, 'The frame rate');
  if (!Number.isFinite(fps) || fps < GIF_MIN_FPS) {
    throw new ToolError(
      `The frame rate must be at least ${GIF_MIN_FPS} fps.`,
      'A frame rate of 0 would produce a GIF that never plays.',
    );
  }
  if (fps > GIF_MAX_FPS) {
    throw new ToolError(
      `The frame rate must be ${GIF_MAX_FPS} fps or less (you asked for ${fps}).`,
      'A GIF cannot carry more frames than that without becoming unusably large.',
    );
  }

  const requestedWidth = readNumber(options.width, 480, 'The output width');
  if (!Number.isFinite(requestedWidth) || requestedWidth < GIF_MIN_WIDTH) {
    throw new ToolError(
      `The output width must be at least ${GIF_MIN_WIDTH} pixels.`,
      'Pick a width of 480 for a good default.',
    );
  }
  if (requestedWidth > GIF_MAX_WIDTH) {
    throw new ToolError(
      `The output width must be ${GIF_MAX_WIDTH} pixels or less (you asked for ${requestedWidth}).`,
      'Smaller frames keep the GIF small and the conversion fast.',
    );
  }
  const width = Math.round(requestedWidth);

  if (!Number.isFinite(source.sourceWidth) || !Number.isFinite(source.sourceHeight)) {
    throw new ToolError('This video reports invalid frame dimensions.');
  }
  if (source.sourceWidth <= 0 || source.sourceHeight <= 0) {
    throw new ToolError('This video reports invalid frame dimensions.');
  }

  const { startSeconds, endSeconds } = resolveTimeRange(options, source);

  const rangeSeconds = endSeconds - startSeconds;
  if (rangeSeconds <= 0) {
    throw new ToolError(
      'The start time must be before the end time.',
      'Set the end time to 0 to run to the end of the clip.',
    );
  }

  const frameCount = Math.max(1, Math.round(rangeSeconds * fps));
  if (frameCount > GIF_MAX_FRAMES) {
    throw new ToolError(
      `That range would produce ${frameCount} frames — the limit is ${GIF_MAX_FRAMES}.`,
      `Shorten the range to ${Math.floor(GIF_MAX_FRAMES / fps)} seconds or lower the frame rate.`,
    );
  }

  const delayMs = Math.max(10, Math.round(1000 / fps / 10) * 10);
  const { width: outWidth, height: outHeight } = fitSize(
    width,
    source.sourceWidth,
    source.sourceHeight,
  );

  return {
    startSeconds,
    endSeconds,
    rangeSeconds,
    fps,
    delayMs,
    effectiveFps: Math.round((1000 / delayMs) * 100) / 100,
    width: outWidth,
    height: outHeight,
    frameCount,
    colors: preset.colors,
    paletteScope: preset.scope,
    dither: preset.dither,
  };
}

/**
 * Work out which slice of the clip the GIF covers.
 *
 * `start` defaults to the beginning of the clip. `end` defaults to the end of
 * the clip, which is why an end time of 0 means "to the end" — there is no
 * sensible zero-length GIF.
 */
export function resolveTimeRange(
  options: Record<string, string | number | boolean | undefined>,
  source: GifSourceInfo,
): { startSeconds: number; endSeconds: number } {
  const duration = source.durationSeconds;
  const start = readNumber(options.start, 0, 'The start time');
  const rawEnd = readNumber(options.end, 0, 'The end time');

  if (!Number.isFinite(start) || start < 0) {
    throw new ToolError('The start time must be 0 seconds or more.');
  }
  if (!Number.isFinite(rawEnd) || rawEnd < 0) {
    throw new ToolError('The end time must be 0 seconds or more.');
  }

  if (duration == null) {
    if (rawEnd > 0) {
      if (rawEnd <= start) {
        throw new ToolError('The start time must be before the end time.');
      }
      // The length of the clip is unknown, so we cannot prove the range fits.
      return { startSeconds: start, endSeconds: rawEnd };
    }
    throw new ToolError(
      'The length of this clip could not be read, so the time range cannot be applied.',
      'Re-export the video, or pick a file whose container reports a duration.',
    );
  }

  if (duration <= 0) {
    throw new ToolError(
      'This clip has no duration, so there is nothing to convert.',
      'Re-export the video — the file may be truncated.',
    );
  }

  if (start >= duration) {
    throw new ToolError(
      `The start time (${start} s) is past the end of the clip (${duration} s).`,
      'Use 0 to start at the beginning.',
    );
  }
  if (rawEnd > 0 && rawEnd > duration) {
    throw new ToolError(
      `The end time (${rawEnd} s) is past the end of the clip (${duration} s).`,
      'Use 0 to run to the end of the clip.',
    );
  }

  const endSeconds = rawEnd > 0 ? rawEnd : duration;
  if (endSeconds <= start) {
    throw new ToolError(
      'The start time must be before the end time.',
      'Use 0 for the end time to run to the end of the clip.',
    );
  }
  return { startSeconds: start, endSeconds };
}

/**
 * Turn the requested width into a frame size, keeping the source aspect ratio
 * and clamping extreme aspect ratios so a frame can never be huge.
 */
export function fitSize(
  width: number,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const ratio = sourceHeight / sourceWidth;
  let height = Math.max(1, Math.round(width * ratio));
  let outWidth = Math.max(1, Math.round(width));
  if (outWidth * height > GIF_MAX_FRAME_PIXELS) {
    const factor = Math.sqrt(GIF_MAX_FRAME_PIXELS / (outWidth * height));
    outWidth = Math.max(1, Math.round(outWidth * factor));
    height = Math.max(1, Math.round(height * factor));
  }
  return { width: outWidth, height };
}

/* -------------------------------------------------------------------------- */
/*  Frame plan                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The timestamps (in seconds, relative to the clip) that the GIF samples.
 * The first frame sits exactly on `start`; the spacing is the requested frame
 * rate, and the last frame always stays inside the range.
 */
export function planFrameTimestamps(start: number, end: number, fps: number): number[] {
  const count = Math.max(1, Math.round((end - start) * fps));
  const step = 1 / fps;
  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(Math.round((start + i * step) * 1e6) / 1e6);
  }
  return timestamps;
}

/**
 * How many of the (sorted) planned timestamps fall strictly before `timestamp`.
 *
 * This is the heart of the frame selection: a planned timestamp is covered by
 * the *last* decoded frame at or before it, so a 30 fps source sampled at
 * 10 fps repeats each frame three times.
 */
export function countTargetsBefore(targets: number[], timestamp: number): number {
  let low = 0;
  let high = targets.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (targets[mid]! < timestamp) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Anything with a presentation timestamp can be sampled. */
export interface TimestampedFrame {
  /** Presentation timestamp in seconds. */
  timestamp: number;
}

/**
 * Pick the decoded frames that become GIF frames.
 *
 * The decoded frames arrive in presentation order and are usually far more
 * numerous than the planned frames, so most of them are dropped. The rule is
 * the one described by {@link countTargetsBefore}:
 *
 *   - a planned timestamp is covered by the last decoded frame at or before it;
 *   - a planned timestamp before the very first decoded frame falls back to
 *     that first frame;
 *   - the tail of the range reuses the last decoded frame.
 *
 * Only one decoded frame is ever held in memory, so a long clip never needs
 * more than a single frame of RAM.
 */
export async function* selectFrames<T extends TimestampedFrame>(
  frames: AsyncIterable<T>,
  targets: number[],
): AsyncGenerator<T, void, undefined> {
  let pending: T | null = null;
  let covered = 0;

  for await (const frame of frames) {
    // Every planned timestamp that falls strictly before this frame is
    // covered by the previous frame.
    const before = countTargetsBefore(targets, frame.timestamp);
    while (covered < before) {
      yield pending ?? frame;
      covered += 1;
    }
    pending = frame;
  }

  // The tail of the range reuses the last decoded frame.
  while (covered < targets.length && pending) {
    yield pending;
    covered += 1;
  }
}

/* -------------------------------------------------------------------------- */
/*  File name                                                                  */
/* -------------------------------------------------------------------------- */

/** `holiday clip.mp4` → `holiday clip.gif` (Unicode is preserved as-is). */
export function gifOutputFilename(sourceName: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  return `${base || 'video'}.gif`;
}

/* -------------------------------------------------------------------------- */
/*  Palette quantisation (median cut)                                          */
/* -------------------------------------------------------------------------- */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type Palette = Rgb[];

/** Bits kept per channel in the histogram (5 → a 32×32×32 colour cube). */
const HIST_BITS = 5;
const HIST_SHIFT = 8 - HIST_BITS;
const HIST_SIZE = 1 << (HIST_BITS * 3);

interface Histogram {
  counts: Uint32Array;
  rSum: Float64Array;
  gSum: Float64Array;
  bSum: Float64Array;
}

interface ColorBox {
  bins: number[];
  count: number;
  minR: number;
  maxR: number;
  minG: number;
  maxG: number;
  minB: number;
  maxB: number;
  locked: boolean;
}

function buildHistogram(rgba: Uint8ClampedArray): Histogram {
  const counts = new Uint32Array(HIST_SIZE);
  const rSum = new Float64Array(HIST_SIZE);
  const gSum = new Float64Array(HIST_SIZE);
  const bSum = new Float64Array(HIST_SIZE);
  const pixels = rgba.length >> 2;
  for (let p = 0; p < pixels; p++) {
    const i = p << 2;
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const bin = ((r >> HIST_SHIFT) << 10) | ((g >> HIST_SHIFT) << 5) | (b >> HIST_SHIFT);
    counts[bin] = counts[bin]! + 1;
    rSum[bin] = rSum[bin]! + r;
    gSum[bin] = gSum[bin]! + g;
    bSum[bin] = bSum[bin]! + b;
  }
  return { counts, rSum, gSum, bSum };
}

function binChannel(bin: number, channel: 0 | 1 | 2): number {
  if (channel === 0) return (bin >> 10) & 31;
  if (channel === 1) return (bin >> 5) & 31;
  return bin & 31;
}

function makeBox(bins: number[], hist: Histogram): ColorBox {
  let count = 0;
  let minR = 31;
  let maxR = 0;
  let minG = 31;
  let maxG = 0;
  let minB = 31;
  let maxB = 0;
  for (const bin of bins) {
    count += hist.counts[bin]!;
    const r = binChannel(bin, 0);
    const g = binChannel(bin, 1);
    const b = binChannel(bin, 2);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  return { bins, count, minR, maxR, minG, maxG, minB, maxB, locked: false };
}

function boxVolume(box: ColorBox): number {
  return (box.maxR - box.minR + 1) * (box.maxG - box.minG + 1) * (box.maxB - box.minB + 1);
}

/**
 * Split a box in two along its longest colour axis, at the population median
 * so both halves carry a similar number of pixels.
 */
function splitBox(box: ColorBox, hist: Histogram): [ColorBox, ColorBox] | null {
  const rangeR = box.maxR - box.minR;
  const rangeG = box.maxG - box.minG;
  const rangeB = box.maxB - box.minB;
  let channel: 0 | 1 | 2 = 0;
  let longest = rangeR;
  if (rangeG > longest) {
    longest = rangeG;
    channel = 1;
  }
  if (rangeB > longest) {
    longest = rangeB;
    channel = 2;
  }
  if (longest <= 0 || box.bins.length < 2) return null;

  const sorted = box.bins.slice().sort((a, b) => binChannel(a, channel) - binChannel(b, channel));
  const half = box.count / 2;
  let accumulated = 0;
  let split = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    accumulated += hist.counts[sorted[i]!]!;
    if (accumulated >= half) {
      split = i + 1;
      break;
    }
    split = i + 2;
  }
  if (split < 1) split = 1;
  if (split > sorted.length - 1) split = sorted.length - 1;

  return [makeBox(sorted.slice(0, split), hist), makeBox(sorted.slice(split), hist)];
}

function boxColor(box: ColorBox, hist: Histogram): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const bin of box.bins) {
    r += hist.rSum[bin]!;
    g += hist.gSum[bin]!;
    b += hist.bSum[bin]!;
  }
  const count = box.count || 1;
  return {
    r: clamp255(Math.round(r / count)),
    g: clamp255(Math.round(g / count)),
    b: clamp255(Math.round(b / count)),
  };
}

function clamp255(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

/**
 * Build a palette of at most `maxColors` colours with a median-cut.
 *
 * The histogram keeps 5 bits per channel, which is more than a GIF palette can
 * ever use, and every palette entry is the exact average of the pixels it
 * covers — so the result is accurate to 8 bits per channel.
 */
export function quantizePalette(rgba: Uint8ClampedArray, maxColors: number): Palette {
  const limit = Math.max(2, Math.min(256, Math.floor(maxColors) || 256));
  const hist = buildHistogram(rgba);
  const occupied: number[] = [];
  for (let bin = 0; bin < HIST_SIZE; bin++) {
    if (hist.counts[bin]) occupied.push(bin);
  }
  if (!occupied.length) return [];
  if (occupied.length <= limit) {
    return occupied.map((bin) => ({
      r: clamp255(Math.round(hist.rSum[bin]! / hist.counts[bin]!)),
      g: clamp255(Math.round(hist.gSum[bin]! / hist.counts[bin]!)),
      b: clamp255(Math.round(hist.bSum[bin]! / hist.counts[bin]!)),
    }));
  }

  let boxes: ColorBox[] = [makeBox(occupied, hist)];
  while (boxes.length < limit) {
    let target = -1;
    let bestVolume = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]!;
      if (box.locked || box.bins.length < 2) continue;
      const volume = boxVolume(box);
      if (volume > bestVolume) {
        bestVolume = volume;
        target = i;
      }
    }
    if (target === -1) break;
    const parts = splitBox(boxes[target]!, hist);
    if (!parts) {
      boxes[target] = { ...boxes[target]!, locked: true };
      continue;
    }
    boxes.splice(target, 1, parts[0], parts[1]);
  }

  return boxes.map((box) => boxColor(box, hist));
}

/* -------------------------------------------------------------------------- */
/*  Pixel → palette index                                                      */
/* -------------------------------------------------------------------------- */

/** Index of the palette colour closest to (r, g, b). */
export function nearestPaletteIndex(r: number, g: number, b: number, palette: Palette): number {
  if (!palette.length) return 0;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const color = palette[i]!;
    const dr = color.r - r;
    const dg = color.g - g;
    const db = color.b - b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** 5-bit-per-channel cache key — the palette is coarser than this anyway. */
function cacheKey(r: number, g: number, b: number): number {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

function lookup(
  r: number,
  g: number,
  b: number,
  palette: Palette,
  cache: Map<number, number>,
): number {
  const key = cacheKey(r, g, b);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const index = nearestPaletteIndex(r, g, b, palette);
  cache.set(key, index);
  return index;
}

/** Map every pixel to the closest palette entry (no dithering). */
export function applyPaletteIndices(rgba: Uint8ClampedArray, palette: Palette): Uint8Array {
  const pixels = rgba.length >> 2;
  const out = new Uint8Array(pixels);
  if (!palette.length) return out;
  const cache = new Map<number, number>();
  for (let p = 0; p < pixels; p++) {
    const i = p << 2;
    out[p] = lookup(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, palette, cache);
  }
  return out;
}

/**
 * Map every pixel to a palette entry with Floyd–Steinberg error diffusion.
 *
 * The quantisation error of each pixel is pushed to its neighbours, which
 * keeps smooth gradients from banding at the cost of a noisier look.
 */
export function ditherToIndices(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
): Uint8Array {
  const out = new Uint8Array(width * height);
  if (!palette.length) return out;
  const cache = new Map<number, number>();

  // One error row per colour channel: `cur` holds the error that has been
  // diffused into the row being written, `next` collects the error for the row
  // below. Index x + 1 is pixel x, which leaves room for the left/right
  // neighbours of the first and last pixel.
  let curR = new Float32Array(width + 2);
  let curG = new Float32Array(width + 2);
  let curB = new Float32Array(width + 2);
  let nextR = new Float32Array(width + 2);
  let nextG = new Float32Array(width + 2);
  let nextB = new Float32Array(width + 2);

  for (let y = 0; y < height; y++) {
    nextR.fill(0);
    nextG.fill(0);
    nextB.fill(0);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = clamp255(Math.round(rgba[i]! + curR[x + 1]!));
      const g = clamp255(Math.round(rgba[i + 1]! + curG[x + 1]!));
      const b = clamp255(Math.round(rgba[i + 2]! + curB[x + 1]!));
      const index = lookup(r, g, b, palette, cache);
      out[y * width + x] = index;
      const color = palette[index]!;
      const er = r - color.r;
      const eg = g - color.g;
      const eb = b - color.b;
      // 7/16 to the right, 3/16 down-left, 5/16 down, 1/16 down-right.
      curR[x + 2] = curR[x + 2]! + er * (7 / 16);
      nextR[x] = nextR[x]! + er * (3 / 16);
      nextR[x + 1] = nextR[x + 1]! + er * (5 / 16);
      nextR[x + 2] = nextR[x + 2]! + er * (1 / 16);
      curG[x + 2] = curG[x + 2]! + eg * (7 / 16);
      nextG[x] = nextG[x]! + eg * (3 / 16);
      nextG[x + 1] = nextG[x + 1]! + eg * (5 / 16);
      nextG[x + 2] = nextG[x + 2]! + eg * (1 / 16);
      curB[x + 2] = curB[x + 2]! + eb * (7 / 16);
      nextB[x] = nextB[x]! + eb * (3 / 16);
      nextB[x + 1] = nextB[x + 1]! + eb * (5 / 16);
      nextB[x + 2] = nextB[x + 2]! + eb * (1 / 16);
    }
    const swapR = curR;
    curR = nextR;
    nextR = swapR;
    const swapG = curG;
    curG = nextG;
    nextG = swapG;
    const swapB = curB;
    curB = nextB;
    nextB = swapB;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  GIF encoding                                                               */
/* -------------------------------------------------------------------------- */

/** The slice of `gifenc` this tool uses. */
export interface GifEncoderApi {
  GIFEncoder: (options?: { initialCapacity?: number; auto?: boolean }) => {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        delay?: number;
        palette?: number[][];
        repeat?: number;
        colorDepth?: number;
        dispose?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}

/**
 * The GIF colour depth (the LZW minimum code size) a palette needs.
 *
 * GIF stores colour tables in powers of two, so a 32-colour palette only
 * needs a 5-bit code size. Getting this right matters: the encoder default of
 * 8 would spend a whole byte per pixel on a 32-colour image.
 */
export function colorDepthForPalette(palette: Palette): number {
  const needed = Math.max(1, palette.length);
  return Math.min(8, Math.max(2, Math.ceil(Math.log2(needed))));
}

/** Lazy-load the encoder (MIT) so it never lands in the main bundle. */
let encoderPromise: Promise<GifEncoderApi> | null = null;

export function loadGifEncoder(): Promise<GifEncoderApi> {
  if (!encoderPromise) {
    const pending: Promise<GifEncoderApi> = import('gifenc')
      .then((mod) => {
        // The package ships both an ESM and a CommonJS build; depending on how
        // the bundler resolves it, the factory may sit on the namespace, on
        // `default`, or on `default.GIFEncoder`.
        const shape = mod as unknown as {
          GIFEncoder?: GifEncoderApi['GIFEncoder'];
          default?: GifEncoderApi['GIFEncoder'] | { GIFEncoder?: GifEncoderApi['GIFEncoder'] };
        };
        const factory =
          shape.GIFEncoder ??
          (typeof shape.default === 'function' ? shape.default : shape.default?.GIFEncoder);
        if (typeof factory !== 'function') {
          throw new Error('The GIF encoder did not export a GIFEncoder factory.');
        }
        return { GIFEncoder: factory };
      })
      .catch(() => {
        // Allow a retry after a transient failure.
        encoderPromise = null;
        throw new ToolError(
          'The GIF encoder could not be loaded.',
          'Reload the page and try again — the encoder is served from this app, not the network.',
        );
      });
    encoderPromise = pending;
    return pending;
  }
  return encoderPromise;
}

/** Whether the encoder has already been fetched in this realm. */
export function isGifEncoderLoaded(): boolean {
  return encoderPromise !== null;
}

function toGifPalette(palette: Palette): number[][] {
  return palette.map((color) => [color.r, color.g, color.b]);
}

/**
 * An incremental GIF writer.
 *
 * Frames are written one by one so a long clip never has to be held in memory
 * all at once.
 */
export interface GifWriter {
  /** Encode one RGBA frame. */
  write(rgba: Uint8ClampedArray): void;
  /** Close the container and return the encoded bytes. */
  finish(): Uint8Array;
}

export type GifWriterSettings = Pick<
  GifSettings,
  'width' | 'height' | 'delayMs' | 'colors' | 'paletteScope' | 'dither'
>;

/**
 * Create a writer for the given settings.
 *
 * With a `global` palette the first frame's palette becomes the GIF's global
 * colour table and every later frame reuses it. With a `local` palette each
 * frame carries its own colour table, which costs a few hundred bytes per
 * frame but keeps the colours accurate.
 */
export function createGifWriter(settings: GifWriterSettings, api: GifEncoderApi): GifWriter {
  const encoder = api.GIFEncoder();
  const expected = settings.width * settings.height * 4;
  let shared: Palette | null = null;
  let frames = 0;

  return {
    write(rgba: Uint8ClampedArray): void {
      if (rgba.length !== expected) {
        throw new ToolError(
          'A decoded frame did not match the requested size.',
          'The video reported dimensions that do not match the frames it produced.',
        );
      }
      const palette =
        settings.paletteScope === 'global'
          ? (shared ??= quantizePalette(rgba, settings.colors))
          : quantizePalette(rgba, settings.colors);
      if (!palette.length) {
        throw new ToolError('A frame came out empty, so the GIF could not be encoded.');
      }
      const indices = settings.dither
        ? ditherToIndices(rgba, settings.width, settings.height, palette)
        : applyPaletteIndices(rgba, palette);
      encoder.writeFrame(indices, settings.width, settings.height, {
        delay: settings.delayMs,
        // The first frame must carry the global colour table; later frames only
        // get a local table when the palette is per frame.
        palette:
          settings.paletteScope === 'local' || frames === 0 ? toGifPalette(palette) : undefined,
        colorDepth: colorDepthForPalette(palette),
        repeat: 0,
      });
      frames++;
    },
    finish(): Uint8Array {
      encoder.finish();
      return encoder.bytes();
    },
  };
}

/** Encode a whole array of RGBA frames into a GIF. */
export function encodeGif(
  frames: Uint8ClampedArray[],
  settings: GifWriterSettings,
  api: GifEncoderApi,
): Uint8Array {
  if (!frames.length) {
    throw new ToolError('No frames were produced, so there is nothing to encode.');
  }
  const writer = createGifWriter(settings, api);
  for (const frame of frames) writer.write(frame);
  return writer.finish();
}

/* -------------------------------------------------------------------------- */
/*  Bytes → data URL                                                           */
/* -------------------------------------------------------------------------- */

/** Base64-encode bytes without blowing the argument limit of `apply`. */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/** A `data:` URL for the encoded GIF — used for the inline preview. */
export function gifDataUrl(bytes: Uint8Array): string {
  return `data:image/gif;base64,${toBase64(bytes)}`;
}

/* -------------------------------------------------------------------------- */
/*  Size estimate                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A rough guess at the encoded size, used for an early warning. The real
 * limit is enforced on the encoded bytes.
 */
export function estimateGifBytes(
  frameCount: number,
  width: number,
  height: number,
  colors: number,
): number {
  const bitsPerPixel = colors <= 32 ? 1.2 : colors <= 128 ? 2.2 : 3.2;
  return Math.round(frameCount * width * height * (bitsPerPixel / 8));
}
