import type { FileRunInput, FileRunResult, FileToolModule, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { extension, parseHexColor, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  encodeCanvas,
  throwIfAborted,
} from './image-batch';
import { decodeHeic, MAX_HEIC_BYTES, type DecodedHeic } from './heic-codec';
import { meta } from './heic-to-jpg.meta';

const FORMATS = ['jpeg', 'png', 'webp'] as const;

/** Validate the requested output format and return its MIME type. */
export function targetMime(value: unknown): string {
  const format = String(value ?? 'jpeg');
  if (!(FORMATS as readonly string[]).includes(format)) {
    throw new ToolError(
      `“${format}” is not a supported output format.`,
      'Choose JPEG, PNG or WebP.',
    );
  }
  return `image/${format}`;
}

/** Parse the JPEG background colour into an RGB triplet. */
export function backgroundRgb(value: unknown): [number, number, number] {
  const rgb = parseHexColor(String(value ?? '#ffffff'));
  if (!rgb) {
    throw new ToolError(
      'Enter the JPEG background as a hex colour, such as #ffffff.',
      'Use a 3- or 6-digit hex value.',
    );
  }
  return rgb;
}

/** Clamp the quality option into the 10–100 range and turn it into a ratio. */
export function outputQuality(value: unknown): number {
  const quality = Number(value);
  if (!Number.isFinite(quality)) return 0.9;
  return Math.min(100, Math.max(10, quality)) / 100;
}

/** True when at least one pixel is not fully opaque. */
export function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true;
  }
  return false;
}

/**
 * Composite RGBA pixels onto a solid background, the way JPEG needs it.
 *
 * The input is returned untouched when nothing is transparent, so the common
 * case costs one scan and no copy.
 */
export function flattenAlpha(
  data: Uint8ClampedArray,
  background: [number, number, number],
): Uint8ClampedArray {
  if (!hasTransparency(data)) return data;
  const out = new Uint8ClampedArray(data);
  const [br, bg, bb] = background;
  for (let i = 0; i < out.length; i += 4) {
    const alpha = out[i + 3]! / 255;
    if (alpha === 1) continue;
    out[i] = Math.round(out[i]! * alpha + br * (1 - alpha));
    out[i + 1] = Math.round(out[i + 1]! * alpha + bg * (1 - alpha));
    out[i + 2] = Math.round(out[i + 2]! * alpha + bb * (1 - alpha));
    out[i + 3] = 255;
  }
  return out;
}

/**
 * Make an output name unique inside one batch: `photo.heic` and `photo.heif`
 * both want to become `photo.jpg`.
 */
export function uniqueStem(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  const name = `${base}-${counter}`;
  used.add(name);
  return name;
}

/** Draw a decoded HEIC onto a canvas and encode it in the target format. */
async function encodeHeic(
  image: DecodedHeic,
  mime: string,
  quality: number,
  background: [number, number, number],
): Promise<Blob> {
  const canvas = createCanvas(image.width, image.height, 'image');
  const ctx = context2d(canvas);
  // JPEG cannot store transparency, so it is flattened onto the background
  // colour first. PNG and WebP keep the alpha channel exactly as decoded.
  const pixels = mime === 'image/jpeg' ? flattenAlpha(image.data, background) : image.data;
  const imageData = ctx.createImageData(image.width, image.height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return encodeCanvas(canvas, mime, quality);
}

/** A short, human-readable reason for a failed file. */
function failureMessage(err: unknown): string {
  if (err instanceof ToolError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'That file could not be converted.';
}

/** Human-readable size of the per-file limit, used in the error message. */
const MAX_HEIC_MB = Math.round(MAX_HEIC_BYTES / 1024 / 1024);

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const files = input.files;
  if (!files.length) throw new ToolError('Choose a HEIC image to convert.');

  const mime = targetMime(o.to);
  const quality = outputQuality(o.quality);
  const background: [number, number, number] =
    mime === 'image/jpeg' ? backgroundRgb(o.background) : [255, 255, 255];

  const outputs: OutputFile[] = [];
  const rows: string[][] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const usedNames = new Set<string>();
  let originalBytes = 0;
  let outputBytes = 0;
  let failed = 0;
  let flattened = 0;

  // The decoder is a separate lazy chunk plus a WASM download; say so before
  // the first file is touched so the wait is never silent.
  input.onProgress?.(0, 'Loading the HEIC decoder…');

  for (let index = 0; index < files.length; index++) {
    const file = files[index]!;
    throwIfAborted(input.signal);
    const start = index / files.length;
    input.onProgress?.(start, `Decoding ${file.name}`);

    try {
      if (file.size > MAX_HEIC_BYTES) {
        throw new ToolError(
          `“${file.name}” is too large to decode (limit ${MAX_HEIC_MB} MB).`,
          'Split the file or pick a smaller export from your camera app.',
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      throwIfAborted(input.signal);
      input.onProgress?.(start + 0.5 / files.length, `Converting ${file.name}`);

      const image = await decodeHeic(bytes, input.signal);
      assertCanvasBudget(image.width, image.height, 'image');
      const blob = await encodeHeic(image, mime, quality, background);

      const filename = `${uniqueStem(stem(file.name), usedNames)}.${extension(mime)}`;
      outputs.push({ filename, blob });
      originalBytes += file.size;
      outputBytes += blob.size;
      if (mime === 'image/jpeg' && hasTransparency(image.data)) flattened += 1;
      rows.push([file.name, filename, `${image.width}×${image.height}`, 'Converted']);
    } catch (err) {
      if (input.signal?.aborted) throw err;
      failed += 1;
      const message = failureMessage(err);
      rows.push([file.name, '—', '—', `Failed — ${message}`]);
      warnings.push(`“${file.name}” — ${message}`);
    }
  }

  input.onProgress?.(1, 'Done');

  // Every file failed: there is nothing to show, so surface the first reason
  // as a proper error instead of an empty result.
  if (!outputs.length && failed) {
    const first = warnings[0] ?? 'None of the selected files could be converted.';
    throw new ToolError(first, 'Check that the files are HEIC images and try again.');
  }

  if (flattened) {
    notes.push(
      `${flattened} image(s) had transparency, which was flattened onto the JPEG background colour.`,
    );
  }
  if (failed) {
    notes.push(`${failed} file(s) could not be converted — see the table for the reason.`);
  }

  return {
    outputs,
    report: {
      output: JSON.stringify({
        headers: ['File', 'Output', 'Dimensions', 'Status'],
        rows,
      }),
      render: 'table',
    },
    notes: notes.length ? notes : undefined,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      files: files.length,
      converted: outputs.length,
      failed,
      originalBytes,
      outputBytes,
      format: mime,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
