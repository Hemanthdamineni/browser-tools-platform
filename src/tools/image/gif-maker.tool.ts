/**
 * GIF Maker — encodes multiple images into an animated GIF using gifenc.
 * All processing happens locally in the Web Worker.
 */
import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  runBatch,
  throwIfAborted,
} from './image-batch';
import { meta } from './gif-maker.meta';

/** Lazy-load the gifenc encoder (MIT) so it never lands in the main bundle. */
let encoderPromise: Promise<GifEncoderApi> | null = null;

/** The slice of `gifenc` this tool uses. */
interface GifEncoderApi {
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

/** Load the gifenc encoder lazily. */
function loadGifEncoder(): Promise<GifEncoderApi> {
  if (!encoderPromise) {
    const pending: Promise<GifEncoderApi> = import('gifenc')
      .then((mod) => {
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

/** Options shape from the meta definition. */
interface GifMakerOptions {
  delay: number;
  loop: number;
  width: number;
  height: number;
  colors: number;
  dither: boolean;
}

/** Validated, resolved options for the processing pipeline. */
interface ResolvedOptions {
  delayMs: number;
  loopCount: number;
  targetWidth: number;
  targetHeight: number;
  maxColors: number;
  dither: boolean;
}

/** Validate and normalise raw options from the UI. */
export function resolveGifOptions(raw: Record<string, unknown>): ResolvedOptions {
  const delay = Number(raw.delay);
  const loop = Number(raw.loop);
  const width = Number(raw.width);
  const height = Number(raw.height);
  const colors = Number(raw.colors);
  const delayMs = Math.max(10, Math.min(10000, Math.floor(Number.isNaN(delay) ? 100 : delay)));
  const loopCount = Math.max(0, Math.min(65535, Math.floor(Number.isNaN(loop) ? 0 : loop)));
  const targetWidth = Math.max(0, Math.min(2048, Math.floor(Number.isNaN(width) ? 0 : width)));
  const targetHeight = Math.max(0, Math.min(2048, Math.floor(Number.isNaN(height) ? 0 : height)));
  const maxColors = Math.max(2, Math.min(256, Math.floor(Number.isNaN(colors) ? 256 : colors)));
  const dither = raw.dither === undefined ? true : Boolean(raw.dither);

  return { delayMs, loopCount, targetWidth, targetHeight, maxColors, dither };
}

/** Compute target dimensions preserving aspect ratio. */
export function computeTargetSize(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
): { width: number; height: number } {
  if (targetWidth === 0 && targetHeight === 0) {
    return { width: srcWidth, height: srcHeight };
  }
  if (targetWidth > 0 && targetHeight > 0) {
    return { width: targetWidth, height: targetHeight };
  }
  const aspect = srcWidth / srcHeight;
  if (targetWidth > 0) {
    return { width: targetWidth, height: Math.round(targetWidth / aspect) };
  }
  return { width: Math.round(targetHeight * aspect), height: targetHeight };
}

/** Apply palette quantisation using median-cut algorithm. */
interface Rgb { r: number; g: number; b: number; }
type Palette = Rgb[];

const HIST_BITS = 5;
const HIST_SHIFT = 8 - HIST_BITS;
const HIST_SIZE = 1 << (HIST_BITS * 3);

interface Histogram {
  bins: Uint32Array;
  total: number;
}

interface ColorBox {
  minR: number; maxR: number;
  minG: number; maxG: number;
  minB: number; maxB: number;
  population: number;
}

function buildHistogram(rgba: Uint8ClampedArray): Histogram {
  const bins = new Uint32Array(HIST_SIZE);
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] >> HIST_SHIFT;
    const g = rgba[i + 1] >> HIST_SHIFT;
    const b = rgba[i + 2] >> HIST_SHIFT;
    const idx = (r << 10) | (g << 5) | b;
    bins[idx]++;
    total++;
  }
  return { bins, total };
}

function makeBox(bins: Uint32Array, hist: Histogram): ColorBox {
  let minR = 31, maxR = 0, minG = 31, maxG = 0, minB = 31, maxB = 0;
  for (let i = 0; i < HIST_SIZE; i++) {
    if (bins[i] === 0) continue;
    const r = (i >> 10) & 31;
    const g = (i >> 5) & 31;
    const b = i & 31;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  return { minR, maxR, minG, maxG, minB, maxB, population: hist.total };
}

function boxVolume(box: ColorBox): number {
  return (box.maxR - box.minR + 1) * (box.maxG - box.minG + 1) * (box.maxB - box.minB + 1);
}

function splitBox(box: ColorBox, hist: Histogram): [ColorBox, ColorBox] | null {
  const bins = hist.bins;
  const rRange = box.maxR - box.minR;
  const gRange = box.maxG - box.minG;
  const bRange = box.maxB - box.minB;
  let axis: 0 | 1 | 2 = 0;
  let maxRange = rRange;
  if (gRange > maxRange) { maxRange = gRange; axis = 1; }
  if (bRange > maxRange) { axis = 2; }

  const half = box.population / 2;
  let sum = 0;
  let split = -1;

  if (axis === 0) {
    for (let r = box.minR; r <= box.maxR; r++) {
      for (let g = box.minG; g <= box.maxG; g++) {
        for (let b = box.minB; b <= box.maxB; b++) {
          sum += bins[(r << 10) | (g << 5) | b];
        }
      }
      if (sum >= half) { split = r; break; }
    }
    if (split === -1 || split === box.maxR) return null;
    const box1: ColorBox = { ...box, maxR: split, population: sum };
    const box2: ColorBox = { ...box, minR: split + 1, population: box.population - sum };
    return [box1, box2];
  } else if (axis === 1) {
    for (let g = box.minG; g <= box.maxG; g++) {
      for (let r = box.minR; r <= box.maxR; r++) {
        for (let b = box.minB; b <= box.maxB; b++) {
          sum += bins[(r << 10) | (g << 5) | b];
        }
      }
      if (sum >= half) { split = g; break; }
    }
    if (split === -1 || split === box.maxG) return null;
    const box1: ColorBox = { ...box, maxG: split, population: sum };
    const box2: ColorBox = { ...box, minG: split + 1, population: box.population - sum };
    return [box1, box2];
  } else {
    for (let b = box.minB; b <= box.maxB; b++) {
      for (let r = box.minR; r <= box.maxR; r++) {
        for (let g = box.minG; g <= box.maxG; g++) {
          sum += bins[(r << 10) | (g << 5) | b];
        }
      }
      if (sum >= half) { split = b; break; }
    }
    if (split === -1 || split === box.maxB) return null;
    const box1: ColorBox = { ...box, maxB: split, population: sum };
    const box2: ColorBox = { ...box, minB: split + 1, population: box.population - sum };
    return [box1, box2];
  }
}

function boxColor(box: ColorBox, hist: Histogram): Rgb {
  const bins = hist.bins;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let r = box.minR; r <= box.maxR; r++) {
    for (let g = box.minG; g <= box.maxG; g++) {
      for (let b = box.minB; b <= box.maxB; b++) {
        const idx = (r << 10) | (g << 5) | b;
        const pop = bins[idx];
        if (pop === 0) continue;
        rSum += r * pop;
        gSum += g * pop;
        bSum += b * pop;
        count += pop;
      }
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0 };
  const avgR = rSum / count;
  const avgG = gSum / count;
  const avgB = bSum / count;
  // Scale from 5-bit (0-31) to 8-bit (0-255)
  const scale = 255 / 31;
  return {
    r: Math.min(255, Math.max(0, Math.round(avgR * scale))),
    g: Math.min(255, Math.max(0, Math.round(avgG * scale))),
    b: Math.min(255, Math.max(0, Math.round(avgB * scale))),
  };
}

export function quantizePalette(rgba: Uint8ClampedArray, maxColors: number): Palette {
  const hist = buildHistogram(rgba);
  if (hist.total === 0) return [{ r: 0, g: 0, b: 0 }];

  const boxes: ColorBox[] = [makeBox(hist.bins, hist)];
  while (boxes.length < maxColors) {
    let bestIdx = -1;
    let bestVol = -1;
    for (let i = 0; i < boxes.length; i++) {
      const vol = boxVolume(boxes[i]);
      if (vol > bestVol && vol > 1) {
        bestVol = vol;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    const split = splitBox(boxes[bestIdx], hist);
    if (!split) break;
    boxes.splice(bestIdx, 1, split[0], split[1]);
  }
  return boxes.map((box) => boxColor(box, hist));
}

export function colorDepthForPalette(palette: Palette): number {
  const needed = Math.max(1, palette.length);
  return Math.min(8, Math.max(2, Math.ceil(Math.log2(needed))));
}

export function toGifPalette(palette: Palette): number[][] {
  return palette.map((color) => [color.r, color.g, color.b]);
}

function nearestPaletteIndex(r: number, g: number, b: number, palette: Palette): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

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
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const idx = nearestPaletteIndex(r, g, b, palette);
  cache.set(key, idx);
  return idx;
}

export function applyPaletteIndices(rgba: Uint8ClampedArray, palette: Palette): Uint8Array {
  const indices = new Uint8Array(rgba.length / 4);
  const cache = new Map<number, number>();
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    indices[j] = lookup(rgba[i], rgba[i + 1], rgba[i + 2], palette, cache);
  }
  return indices;
}

export function ditherToIndices(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
): Uint8Array {
  const indices = new Uint8Array(rgba.length / 4);
  const cache = new Map<number, number>();
  const errR = new Float32Array(width + 2);
  const errG = new Float32Array(width + 2);
  const errB = new Float32Array(width + 2);
  const nextErrR = new Float32Array(width + 2);
  const nextErrG = new Float32Array(width + 2);
  const nextErrB = new Float32Array(width + 2);

  for (let y = 0; y < height; y++) {
    errR.fill(0);
    errG.fill(0);
    errB.fill(0);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = Math.min(255, Math.max(0, rgba[i] + errR[x + 1]));
      let g = Math.min(255, Math.max(0, rgba[i + 1] + errG[x + 1]));
      let b = Math.min(255, Math.max(0, rgba[i + 2] + errB[x + 1]));
      const idx = lookup(r, g, b, palette, cache);
      indices[y * width + x] = idx;
      const pc = palette[idx];
      const er = r - pc.r;
      const eg = g - pc.g;
      const eb = b - pc.b;
      errR[x + 2] += (er * 7) / 16;
      errG[x + 2] += (eg * 7) / 16;
      errB[x + 2] += (eb * 7) / 16;
      nextErrR[x] += (er * 3) / 16;
      nextErrG[x] += (eg * 3) / 16;
      nextErrB[x] += (eb * 3) / 16;
      nextErrR[x + 1] += (er * 5) / 16;
      nextErrG[x + 1] += (eg * 5) / 16;
      nextErrB[x + 1] += (eb * 5) / 16;
      nextErrR[x + 2] += (er * 1) / 16;
      nextErrG[x + 2] += (eg * 1) / 16;
      nextErrB[x + 2] += (eb * 1) / 16;
    }
    for (let x = 0; x < width + 2; x++) {
      errR[x] = nextErrR[x];
      errG[x] = nextErrG[x];
      errB[x] = nextErrB[x];
    }
    nextErrR.fill(0);
    nextErrG.fill(0);
    nextErrB.fill(0);
  }
  return indices;
}

/** Process a single frame: decode, resize, get RGBA. */
async function processFrame(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<Uint8ClampedArray> {
  const canvas = createCanvas(targetWidth, targetHeight);
  const ctx = context2d(canvas);
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  return imageData.data;
}

/** Encode frames into GIF using gifenc. */
async function encodeFramesToGif(
  frames: Uint8ClampedArray[],
  settings: ResolvedOptions,
  api: GifEncoderApi,
): Promise<Uint8Array> {
  if (!frames.length) {
    throw new ToolError('No frames were produced, so there is nothing to encode.');
  }

  const encoder = api.GIFEncoder();
  const firstFrame = frames[0];
  const width = settings.targetWidth;
  const height = settings.targetHeight;

  // Quantize palette from first frame (global palette)
  const palette = quantizePalette(firstFrame, settings.maxColors);
  const gifPalette = toGifPalette(palette);
  const colorDepth = colorDepthForPalette(palette);

  let frameCount = 0;
  for (const frame of frames) {
    let indices: Uint8Array;
    if (settings.dither) {
      indices = ditherToIndices(frame, width, height, palette);
    } else {
      indices = applyPaletteIndices(frame, palette);
    }

    encoder.writeFrame(indices, width, height, {
      delay: settings.delayMs,
      palette: frameCount === 0 ? gifPalette : undefined,
      repeat: frameCount === 0 ? settings.loopCount : 0,
      colorDepth,
    });
    frameCount++;
  }

  encoder.finish();
  return encoder.bytes();
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const rawOptions = resolveOptions(meta, input.options);
  const options = resolveGifOptions(rawOptions);
  checkFiles(input.files, true);
  throwIfAborted(input.signal);

  const MAX_FRAMES = 300;
  if (input.files.length > MAX_FRAMES) {
    throw new ToolError(`Too many frames (${input.files.length}). Maximum is ${MAX_FRAMES}.`);
  }

  // Decode all frames first
  const bitmaps: ImageBitmap[] = [];
  try {
    await runBatch(input.files, input, 'Decoding', async (file, index) => {
      throwIfAborted(input.signal);
      const bitmap = await decodeOriented(file);
      assertCanvasBudget(bitmap.width, bitmap.height, `frame ${index + 1}`);
      bitmaps.push(bitmap);
    });
  } catch (e) {
    bitmaps.forEach((b) => b.close());
    throw e;
  }

  // Determine target dimensions from first frame if not specified
  const firstBitmap = bitmaps[0]!;
  const { width: targetWidth, height: targetHeight } = computeTargetSize(
    firstBitmap.width,
    firstBitmap.height,
    options.targetWidth,
    options.targetHeight,
  );
  options.targetWidth = targetWidth;
  options.targetHeight = targetHeight;
  assertCanvasBudget(targetWidth, targetHeight, 'output GIF frame');

  // Process frames to RGBA
  const frames: Uint8ClampedArray[] = [];
  input.onProgress?.(0.5, 'Processing frames');
  for (let i = 0; i < bitmaps.length; i++) {
    throwIfAborted(input.signal);
    const frameData = await processFrame(bitmaps[i]!, targetWidth, targetHeight);
    frames.push(frameData);
    input.onProgress?.(0.5 + 0.3 * ((i + 1) / bitmaps.length), `Processing frame ${i + 1}/${bitmaps.length}`);
  }

  // Clean up bitmaps
  bitmaps.forEach((b) => b.close());

  // Load encoder and encode
  input.onProgress?.(0.8, 'Encoding GIF');
  const api = await loadGifEncoder();
  const gifBytes = await encodeFramesToGif(frames, options, api);

  // Create output blob
  const blob = new Blob([gifBytes], { type: 'image/gif' });
  const filename = `animation.gif`;

  input.onProgress?.(1, 'Done');

  return {
    outputs: [
      {
        filename,
        blob,
        previewUrl: `data:image/gif;base64,${btoa(String.fromCharCode(...new Uint8Array(gifBytes)))}`,
      },
    ],
    stats: {
      frames: frames.length,
      width: targetWidth,
      height: targetHeight,
      delayMs: options.delayMs,
      loopCount: options.loopCount,
      colors: options.maxColors,
      dither: options.dither,
      outputBytes: blob.size,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;