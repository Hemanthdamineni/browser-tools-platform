import type { FileRunInput, FileRunResult, FileToolModule, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import type {
  HeifDecoderInstance,
  HeifImageHandle,
  LibheifModule,
} from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import { resolveOptions } from '@/lib/options';
import { canvasFor } from '@/lib/image';
import { formatBytes } from '@/lib/format';
import { checkAbort, parseHexColor } from './common';
import { meta } from './heic-to-jpg.meta';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                    */
/* -------------------------------------------------------------------------- */

/** Per-file ceiling. Comfortably above any camera HEIC, low enough to fail clearly. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Pixel ceiling: decoding RGBA needs ~4 bytes/pixel, and encoding copies it once. */
export const MAX_PIXELS = 50_000_000;

/* -------------------------------------------------------------------------- */
/*  Pure option / naming / pixel logic — no browser APIs, unit-tested directly */
/* -------------------------------------------------------------------------- */

export interface ResolvedFormat {
  /** What the canvas is asked to encode. */
  mime: string;
  /** File extension for the output. */
  extension: string;
}

const FORMATS: Record<string, ResolvedFormat> = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  jpg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
  webp: { mime: 'image/webp', extension: 'webp' },
};

/** Map the `format` option onto a canvas MIME type and a file extension. */
export function resolveFormat(value: unknown): ResolvedFormat {
  const key = String(value ?? 'jpeg')
    .trim()
    .toLowerCase();
  const format = FORMATS[key];
  if (!format) {
    throw new ToolError(`"${key}" is not a supported output format.`, 'Choose JPEG, PNG or WebP.');
  }
  return format;
}

/** Canvas `quality` (0–1) for lossy formats; `undefined` for lossless PNG. */
export function resolveQuality(value: unknown, mime: string): number | undefined {
  if (mime === 'image/png') return undefined;
  const n = Number(value);
  const percent = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 90;
  return Math.round(percent) / 100;
}

/** Scale `width`×`height` so the longest edge is at most `maxDimension`. Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  maxDimension: unknown,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ToolError(
      'The decoded image has invalid dimensions.',
      'The HEIC file may be corrupt.',
    );
  }
  const limit = Number(maxDimension);
  if (!Number.isFinite(limit) || limit <= 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = Math.min(1, limit / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** `IMG_1234.HEIC` → `IMG_1234.jpg`. Unicode names are preserved. */
export function outputFilename(name: string, extension: string): string {
  const stem = name.replace(/\.[^.]*$/, '').trim() || 'image';
  return `${stem}.${extension}`;
}

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_EXTENSION = /\.(?:heic|heif)$/i;

/** True when a file is plausibly HEIC/HEIF, judged by extension or MIME type. */
export function isHeicLike(file: { name: string; type: string }): boolean {
  return HEIC_EXTENSION.test(file.name) || HEIC_MIME_TYPES.has(file.type.trim().toLowerCase());
}

/** Validate one selection before any expensive decoder work happens. */
export function checkHeicFile(file: { name: string; type: string; size: number }): void {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new ToolError(`"${file.name}" is empty.`, 'Choose a HEIC file that contains a photo.');
  }
  if (!isHeicLike(file)) {
    throw new ToolError(
      `"${file.name}" is not a HEIC or HEIF image.`,
      'Choose a file ending in .heic or .heif.',
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ToolError(
      `"${file.name}" is too large to convert (${formatBytes(file.size)}).`,
      `The limit is ${formatBytes(MAX_FILE_BYTES)} per file.`,
    );
  }
}

/** Index of the primary image in a container, falling back to the first. */
export function primaryIndex(primaryFlags: boolean[]): number {
  const i = primaryFlags.indexOf(true);
  return i === -1 ? 0 : i;
}

/**
 * Flatten straight (non-premultiplied) RGBA onto a solid colour, in place.
 * Fully opaque pixels are left untouched.
 */
export function compositeOntoBackground(
  rgba: Uint8ClampedArray,
  background: readonly [number, number, number],
): void {
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const alpha = rgba[i + 3]! / 255;
    if (alpha >= 1) continue;
    rgba[i] = Math.round(rgba[i]! * alpha + background[0] * (1 - alpha));
    rgba[i + 1] = Math.round(rgba[i + 1]! * alpha + background[1] * (1 - alpha));
    rgba[i + 2] = Math.round(rgba[i + 2]! * alpha + background[2] * (1 - alpha));
    rgba[i + 3] = 255;
  }
}

/* -------------------------------------------------------------------------- */
/*  Decoder                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * libheif-js ships the LGPL-3.0 libheif codec as WebAssembly (~700 KB
 * gzipped). It is pulled in with a dynamic `import()` so it lands in its own
 * chunk: the main bundle never grows, and nothing is fetched until the first
 * conversion. `libheif-js` is bundled locally — there is no runtime download.
 */
let decoderPromise: Promise<LibheifModule> | null = null;

function loadDecoder(): Promise<LibheifModule> {
  decoderPromise ??= (async () => {
    try {
      const module = await import('libheif-js/libheif-wasm/libheif-bundle.mjs');
      return await module.default();
    } catch {
      // Let a later attempt retry rather than caching a permanent failure.
      decoderPromise = null;
      throw new ToolError(
        'The HEIC decoder could not be loaded in this browser.',
        'Try a recent Chrome, Edge, Firefox or Safari with WebAssembly enabled.',
      );
    }
  })();
  return decoderPromise;
}

interface DecodedHeic {
  width: number;
  height: number;
  /** Straight RGBA pixels, `width * height * 4` long. */
  pixels: Uint8ClampedArray;
  hasAlpha: boolean;
  /** Number of still images found inside the container. */
  imageCount: number;
}

async function decodeHeic(
  decoder: HeifDecoderInstance,
  file: File,
  signal?: AbortSignal,
): Promise<DecodedHeic> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkAbort(signal);

  let images: HeifImageHandle[];
  try {
    images = decoder.decode(bytes);
  } catch {
    throw new ToolError(
      `"${file.name}" could not be read as a HEIC/HEIF image.`,
      'The file looks truncated or corrupt.',
    );
  }
  if (!images.length) {
    throw new ToolError(
      `"${file.name}" could not be decoded as HEIC/HEIF.`,
      'It may be corrupt, or an unsupported variant such as AVIF or an HEVC video track.',
    );
  }

  const image = images[primaryIndex(images.map((img) => img.is_primary()))]!;
  const width = image.get_width();
  const height = image.get_height();
  const imageCount = images.length;

  // Check the declared size *before* allocating, so a malformed header cannot
  // exhaust memory.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ToolError(
      `"${file.name}" reports an invalid image size.`,
      'The HEIC file may be corrupt.',
    );
  }
  if (width * height > MAX_PIXELS) {
    throw new ToolError(
      `"${file.name}" is too large to convert safely (${width} × ${height} pixels).`,
      `The limit is ${MAX_PIXELS / 1_000_000} megapixels per image.`,
    );
  }

  const pixels = new Uint8ClampedArray(width * height * 4);
  const decoded = await new Promise<boolean>((resolve) => {
    image.display({ data: pixels, width, height }, (result) => resolve(Boolean(result)));
  });
  const hasAlpha = image.has_alpha_channel();
  for (const img of images) {
    try {
      img.free();
    } catch {
      /* handle already released — nothing to do */
    }
  }
  if (!decoded) {
    throw new ToolError(
      `"${file.name}" could not be decoded.`,
      'The HEIC file may be corrupt or use a codec this decoder does not support.',
    );
  }
  return { width, height, pixels, hasAlpha, imageCount };
}

/* -------------------------------------------------------------------------- */
/*  Encoder                                                                   */
/* -------------------------------------------------------------------------- */

async function encode(
  pixels: Uint8ClampedArray,
  source: { width: number; height: number },
  target: { width: number; height: number },
  format: ResolvedFormat,
  quality: number | undefined,
): Promise<Blob> {
  const sourceCanvas = canvasFor(source.width, source.height);
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new ToolError('Your browser could not create a 2D drawing context.');
  const imageData = sourceCtx.createImageData(source.width, source.height);
  imageData.data.set(pixels);
  sourceCtx.putImageData(imageData, 0, 0);

  const canvas = canvasFor(target.width, target.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ToolError('Your browser could not create a 2D drawing context.');
  ctx.drawImage(sourceCanvas, 0, 0, target.width, target.height);

  const blob = await canvas.convertToBlob({ type: format.mime, quality });
  if (blob.type !== format.mime) {
    throw new ToolError(
      `This browser cannot encode ${format.mime.replace('image/', '').toUpperCase()}.`,
      'Try JPEG or PNG instead.',
    );
  }
  return blob;
}

/* -------------------------------------------------------------------------- */
/*  run()                                                                     */
/* -------------------------------------------------------------------------- */

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose at least one HEIC or HEIF file.');

  const format = resolveFormat(o.format);
  const quality = resolveQuality(o.quality, format.mime);
  const backgroundHex = String(o.background ?? '#ffffff');
  const background = parseHexColor(backgroundHex) ?? [255, 255, 255];

  // Reject anything we can decide without spinning up the decoder.
  for (const file of input.files) checkHeicFile(file);

  const outputs: OutputFile[] = [];
  const warnings: string[] = [];
  let originalBytes = 0;
  let outputBytes = 0;
  let flattened = false;
  let decoder: LibheifModule | null = null;

  const total = input.files.length;
  for (let i = 0; i < total; i++) {
    checkAbort(input.signal);
    const file = input.files[i]!;
    originalBytes += file.size;
    const progress = i / total;

    if (!decoder) {
      input.onProgress?.(progress, 'Loading HEIC decoder (first run only)');
      decoder = await loadDecoder();
      checkAbort(input.signal);
    }
    input.onProgress?.(progress, `Converting ${file.name}`);

    const decoded = await decodeHeic(decoder, file, input.signal);
    checkAbort(input.signal);
    if (decoded.imageCount > 1) {
      warnings.push(
        `${file.name}: ${decoded.imageCount} images found — converted the primary image only.`,
      );
    }

    if (format.mime === 'image/jpeg') {
      if (decoded.hasAlpha) flattened = true;
      compositeOntoBackground(decoded.pixels, background);
    }

    const target = fitWithin(decoded.width, decoded.height, o.maxDimension);
    const blob = await encode(decoded.pixels, decoded, target, format, quality);

    const filename = outputFilename(file.name, format.extension);
    if (blob.size > file.size) {
      warnings.push(
        `${filename} is larger than the original (${formatBytes(blob.size)} vs ${formatBytes(file.size)}).`,
      );
    }
    outputs.push({ filename, blob });
    outputBytes += blob.size;
    input.onProgress?.((i + 1) / total, `Converted ${file.name}`);
  }

  input.onProgress?.(1, 'Done');

  const notes = [
    `Converted ${outputs.length} ${outputs.length === 1 ? 'file' : 'files'}: ${formatBytes(originalBytes)} → ${formatBytes(outputBytes)}.`,
    'Metadata (EXIF, GPS, colour profiles) is not copied — only the pixels are re-encoded.',
    'HEIF rotation is applied while decoding, so the output is already upright.',
  ];
  if (flattened) {
    notes.push(`Transparent areas were flattened onto ${backgroundHex}.`);
  }

  return {
    outputs,
    warnings: warnings.length ? warnings : undefined,
    notes,
    stats: {
      files: outputs.length,
      format: format.mime,
      originalBytes,
      outputBytes,
      originalSize: formatBytes(originalBytes),
      outputSize: formatBytes(outputBytes),
      savedPercent: originalBytes
        ? Math.round((1 - outputBytes / originalBytes) * 1000) / 10
        : 0,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
