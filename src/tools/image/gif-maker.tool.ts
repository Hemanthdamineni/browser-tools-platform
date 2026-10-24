/**
 * Image frames → animated GIF.
 *
 * The reordering and per-frame timing happen in the `gif-maker` panel; this
 * tool takes the already-ordered files (in `input.files`) plus a per-frame
 * delay list and encodes them into an animated GIF with `gifenc` (MIT). The
 * pure maths — delay normalisation to GIF centiseconds (with the 33.3 fps
 * caveat), the size-limit downscaling and the total-duration display — lives
 * in `src/components/panels/gif-maker-panel.ts`, shared by the panel and this
 * worker so they always agree.
 *
 * The heavy lifting (decoding, drawing, quantising, encoding) happens in the
 * tool worker, so the page never freezes. Nothing leaves the device.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { assertCanvasBudget, context2d, createCanvas, decodeOriented } from './image-batch';
import {
  MIN_DELAY_CS,
  MAX_DELAY_CS,
  normalizeDelayCs,
  sizeForLimit,
} from '@/components/panels/gif-maker-panel';
import {
  applyPaletteIndices,
  colorDepthForPalette,
  ditherToIndices,
  gifDataUrl,
  loadGifEncoder,
  palettePreset,
  quantizePalette,
  estimateGifBytes,
  GIF_MAX_OUTPUT_BYTES,
  GIF_MAX_PREVIEW_BYTES,
  type GifEncoderApi,
  type Palette,
  type PaletteScope,
} from '@/tools/video/gif';
import { meta } from './gif-maker.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** One decoded frame, already scaled to the output size. */
export interface MakerFrame {
  /** RGBA pixels, `width * height * 4` bytes. */
  rgba: Uint8ClampedArray;
  /** Delay in GIF centiseconds. */
  delayCs: number;
}

export interface MakerContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** Decodes the ordered files into scaled RGBA frames. Injectable for tests. */
export type FrameLoader = (
  files: File[],
  targetWidth: number,
  colors: number,
  limitBytes: number,
  ctx: MakerContext,
) => Promise<{ frames: MakerFrame[]; width: number; height: number }>;

/** Encodes scaled frames into GIF bytes. Injectable for tests. */
export type MakerEncoder = (
  frames: MakerFrame[],
  settings: MakerSettings,
  api: GifEncoderApi,
) => Uint8Array;

export interface MakerSettings {
  width: number;
  height: number;
  colors: number;
  paletteScope: PaletteScope;
  dither: boolean;
  /** Loop count; 0 = forever. */
  loop: number;
  /** Per-frame delays, one per frame, in centiseconds. */
  delaysCs: number[];
}

/* -------------------------------------------------------------------------- */
/*  Decoding                                                                  */
/* -------------------------------------------------------------------------- */

/** Draw a decoded bitmap onto a canvas at the output size. */
function drawScaled(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray {
  const canvas = createCanvas(width, height, 'output frame');
  const ctx = context2d(canvas);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Decode every ordered file, scaled to a common output size. The natural size
 * comes from the first frame (the aspect ratio anchor); the output is then
 * shrunk, never grown, to fit the target width and the size limit. Every later
 * frame is drawn into the same box, so they all match.
 */
export async function loadFrames(
  files: File[],
  targetWidth: number,
  colors: number,
  limitBytes: number,
  ctx: MakerContext,
): Promise<{ frames: MakerFrame[]; width: number; height: number }> {
  if (!files.length) {
    throw new ToolError('Choose at least one image to make a GIF.');
  }
  ctx.signal?.throwIfAborted?.();
  ctx.onProgress?.(0.05, 'Reading the first frame');
  let anchor: ImageBitmap;
  try {
    anchor = await decodeOriented(files[0]!);
  } catch {
    throw new ToolError(
      `“${files[0]!.name}” could not be decoded as an image.`,
      'Choose PNG, JPEG, WebP, GIF or BMP frames.',
    );
  }
  try {
    assertCanvasBudget(anchor.width, anchor.height, `"${files[0]!.name}"`);
  } catch (error) {
    anchor.close();
    throw error;
  }
  const size = sizeForLimit(
    files.length,
    anchor.width,
    anchor.height,
    targetWidth,
    colors,
    limitBytes,
  );
  anchor.close();

  const out: MakerFrame[] = [];
  for (let i = 0; i < files.length; i++) {
    ctx.signal?.throwIfAborted?.();
    ctx.onProgress?.(0.1 + 0.5 * (i / files.length), `Reading ${files[i]!.name}`);
    let bitmap: ImageBitmap;
    try {
      bitmap = await decodeOriented(files[i]!);
    } catch {
      throw new ToolError(
        `“${files[i]!.name}” could not be decoded as an image.`,
        'Choose PNG, JPEG, WebP, GIF or BMP frames.',
      );
    }
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, `"${files[i]!.name}"`);
    } catch (error) {
      bitmap.close();
      throw error;
    }
    const rgba = drawScaled(bitmap, size.width, size.height);
    bitmap.close();
    out.push({ rgba, delayCs: 0 });
  }
  return { frames: out, width: size.width, height: size.height };
}

/* -------------------------------------------------------------------------- */
/*  Encoding                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Encode the frames into a GIF, giving each frame its own delay and writing
 * the loop count on the first frame. Palette quality reuses the shared video
 * GIF core.
 */
export function encodeFrames(
  frames: MakerFrame[],
  settings: MakerSettings,
  api: GifEncoderApi,
): Uint8Array {
  if (!frames.length) {
    throw new ToolError('No frames were produced, so there is nothing to encode.');
  }
  const expected = settings.width * settings.height * 4;
  const encoder = api.GIFEncoder();
  let shared: Palette | null = null;
  frames.forEach((frame, index) => {
    if (frame.rgba.length !== expected) {
      throw new ToolError(
        'A decoded frame did not match the requested size.',
        'The frames may have reported inconsistent dimensions.',
      );
    }
    const palette =
      settings.paletteScope === 'global'
        ? (shared ??= quantizePalette(frame.rgba, settings.colors))
        : quantizePalette(frame.rgba, settings.colors);
    if (!palette.length) {
      throw new ToolError('A frame came out empty, so the GIF could not be encoded.');
    }
    const indices = settings.dither
      ? ditherToIndices(frame.rgba, settings.width, settings.height, palette)
      : applyPaletteIndices(frame.rgba, palette);
    encoder.writeFrame(indices, settings.width, settings.height, {
      delay: Math.max(MIN_DELAY_CS, Math.min(MAX_DELAY_CS, settings.delaysCs[index] ?? 0)),
      palette:
        settings.paletteScope === 'local' || index === 0
          ? palette.map((color) => [color.r, color.g, color.b])
          : undefined,
      colorDepth: colorDepthForPalette(palette),
      // The loop count lives on the first frame; later frames ignore it.
      repeat: index === 0 ? settings.loop : 0,
    });
  });
  encoder.finish();
  return encoder.bytes();
}
/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

/** Read a numeric option, failing loudly on garbage instead of silently defaulting. */
function readNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (trimmed === '') return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw new ToolError(`${label} must be a number.`, `"${String(value)}" is not a number.`);
  }
  return n;
}

/** The loop count option: 0 = forever, otherwise a positive count (capped at 1000). */
function readLoop(value: unknown): number {
  const loop = Math.round(readNumber(value, 0, 'The loop count'));
  if (loop < 0) {
    throw new ToolError('The loop count cannot be negative.', 'Use 0 to loop forever.');
  }
  return Math.min(loop, 1000);
}

/**
 * The per-frame delay list, in GIF centiseconds. `[]` (the default) means
 * "use the uniform default for every frame"; otherwise one entry is expected
 * per frame.
 */
function readDelays(raw: unknown, count: number, fallback: number): number[] {
  const value = raw === undefined || raw === null ? '[]' : String(raw).trim();
  if (value === '' || value === '[]' || value === 'null') {
    return Array.from({ length: count }, () => normalizeDelayCs(fallback, 10));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ToolError(
      'The per-frame delay list is not valid JSON.',
      'Enter delays like [10, 5, 20] — one hundredth of a second per frame.',
    );
  }
  if (!Array.isArray(parsed)) {
    throw new ToolError(
      'The per-frame delay list must be an array of numbers.',
      'Enter delays like [10, 5, 20] — one hundredth of a second per frame.',
    );
  }
  if (parsed.length !== count) {
    throw new ToolError(
      `The per-frame delay list has ${parsed.length} entries for ${count} frame${count === 1 ? '' : 's'}.`,
      'Provide exactly one delay per frame, or leave it empty for the default.',
    );
  }
  return parsed.map((entry) => normalizeDelayCs(entry, fallback));
}

/* -------------------------------------------------------------------------- */
/*  Tool                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build the GIF: the ordered files and per-frame delays come from the panel,
 * the encode runs here (in the worker) so the page stays responsive. The
 * injectable seams let the unit tests drive the decode and encode branches
 * without a real canvas codec.
 */
export async function runGifMaker(
  input: FileRunInput,
  load: FrameLoader = loadFrames,
  encode: MakerEncoder = encodeFrames,
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const files = input.files;
  if (!files.length) throw new ToolError('Choose at least one image to make a GIF.');
  if (files.length > 100) {
    throw new ToolError(`Choose at most 100 frames — ${files.length} were selected.`);
  }
  if (files.some((file) => !file.type.startsWith('image/'))) {
    throw new ToolError(
      'One of the selected files is not an image.',
      'Choose PNG, JPEG, WebP, GIF or BMP frames.',
    );
  }
  const { signal, onProgress } = input;
  signal?.throwIfAborted?.();

  const preset = palettePreset(o.palette);
  const targetWidth = Math.max(1, Math.round(readNumber(o.width, 480, 'The output width')));
  const limitMb = readNumber(o.sizeLimit, 4, 'The size limit');
  if (limitMb < 0) {
    throw new ToolError(
      'The size limit cannot be negative.',
      'Set a limit in megabytes, or 0 for no limit.',
    );
  }
  const limitBytes = Math.round(limitMb * 1024 * 1024);
  const loop = readLoop(o.loop);
  const uniformCs = normalizeDelayCs(o.delayCs, 10);

  onProgress?.(0.02, 'Decoding the frames');
  const { frames, width, height } = await load(files, targetWidth, preset.colors, limitBytes, {
    signal,
    onProgress,
  });

  const delaysCs = readDelays(o.frameDelays, frames.length, uniformCs);

  onProgress?.(0.62, 'Loading the GIF encoder');
  const api = await loadGifEncoder();
  const bytes = encode(
    frames.map((frame, index) => ({ rgba: frame.rgba, delayCs: delaysCs[index]! })),
    { width, height, colors: preset.colors, paletteScope: preset.scope, dither: preset.dither, loop, delaysCs },
    api,
  );

  if (bytes.byteLength > GIF_MAX_OUTPUT_BYTES) {
    throw new ToolError(
      `The GIF came out at ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB — over the ${GIF_MAX_OUTPUT_BYTES / 1024 / 1024} MB limit.`,
      'Lower the width or the size limit, or use fewer frames.',
    );
  }
  onProgress?.(1, 'Done');

  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/gif' });
  const previewable = bytes.byteLength <= GIF_MAX_PREVIEW_BYTES;
  const previewUrl = previewable ? gifDataUrl(bytes) : undefined;

  const estimated = estimateGifBytes(frames.length, width, height, preset.colors);
  const notes: string[] = [
    previewUrl
      ? 'The animation above is a preview — save the GIF to keep it.'
      : 'The GIF was too large to preview here — save it to view it.',
    `${frames.length} frame${frames.length === 1 ? '' : 's'} · ${width} × ${height} · ${loop === 0 ? 'loops forever' : `loops ${loop}×`}`,
  ];
  if (estimated > bytes.byteLength * 1.5) {
    notes.push('The frames were downscaled to fit the size limit.');
  }

  return {
    outputs: [{ filename: 'animation.gif', blob, previewUrl }],
    report: previewUrl ? { output: previewUrl, render: 'image' } : undefined,
    notes,
    stats: {
      frames: frames.length,
      width,
      height,
      loop,
      durationMs: delaysCs.reduce((sum, cs) => sum + cs * 10, 0),
      sizeBytes: bytes.byteLength,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runGifMaker(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
