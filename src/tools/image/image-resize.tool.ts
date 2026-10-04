import type {
  FileRunInput,
  FileRunResult,
  OptionValues,
  OutputFile,
} from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { meta } from './image-resize.meta';

/* -------------------------------------------------------------------------- */
/*  Pure sizing math — exported so it is unit-testable without a browser.     */
/* -------------------------------------------------------------------------- */

export interface ResizeOptions {
  mode: string;
  width: number;
  height: number;
  percent: number;
  upscale: boolean;
}

export interface TargetSize {
  width: number;
  height: number;
  /** True when the result was constrained to the source because upscaling is off. */
  limited: boolean;
}

/**
 * Compute the target pixel size for `srcW × srcH`.
 *
 * Modes:
 *  - `fit`        contain: scale so the whole image fits in width×height
 *  - `fill`       cover + centre-crop: scale so the box is covered, then crop
 *  - `exact`      stretch to width×height
 *  - `percent`    scale by `percent`% (relative to the source)
 *  - `max-width`  clamp width to `width`, scale height to keep aspect
 *  - `max-height` clamp height to `height`, scale width to keep aspect
 *
 * Unless `upscale` is true, no mode enlarges the source beyond the size the
 * mode implies; `fill` and `exact` are deliberately excluded from that guard
 * because the user chose them to reach `width × height` exactly (a `fill`
 * crop of a smaller image is still a valid, honest crop). `limited` is only
 * set by the guard, so callers know when an image was left unchanged.
 */
export function computeTargetSize(
  srcW: number,
  srcH: number,
  opts: ResizeOptions,
): TargetSize {
  if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
    throw new ToolError('The image has invalid dimensions.');
  }

  const W = Math.max(1, Math.round(opts.width));
  const H = Math.max(1, Math.round(opts.height));
  const sW = Math.max(1, srcW);
  const sH = Math.max(1, srcH);

  let width: number;
  let height: number;
  let limited = false;

  switch (opts.mode) {
    case 'exact':
      width = W;
      height = H;
      break;

    case 'fill': {
      const scale = Math.max(W / sW, H / sH);
      if (opts.upscale || scale <= 1) {
        width = W;
        height = H;
      } else if (sW / sH > W / H) {
        width = Math.max(1, Math.round(sH * (W / H)));
        height = sH;
        limited = true;
      } else {
        width = sW;
        height = Math.max(1, Math.round(sW * (H / W)));
        limited = true;
      }
      break;
    }

    case 'percent': {
      const p = clamp(Number(opts.percent), 1, 400) / 100;
      width = Math.max(1, Math.round(sW * p));
      height = Math.max(1, Math.round(sH * p));
      break;
    }

    case 'max-width': {
      const scale = opts.upscale ? W / sW : Math.min(1, W / sW);
      width = Math.round(sW * scale);
      height = Math.round(sH * scale);
      limited = !opts.upscale && W > sW;
      break;
    }

    case 'max-height': {
      const scale = opts.upscale ? H / sH : Math.min(1, H / sH);
      width = Math.round(sW * scale);
      height = Math.round(sH * scale);
      limited = !opts.upscale && H > sH;
      break;
    }

    case 'fit':
    default: {
      const scale = Math.min(W / sW, H / sH);
      if (!opts.upscale && scale > 1) limited = true;
      const s = opts.upscale ? scale : Math.min(1, scale);
      width = Math.max(1, Math.round(sW * s));
      height = Math.max(1, Math.round(sH * s));
      break;
    }
  }

  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  return { width, height, limited };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/* -------------------------------------------------------------------------- */
/*  Output plumbing                                                           */
/* -------------------------------------------------------------------------- */

const MIME: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  original: '',
};

function extForMime(type: string): string {
  switch (type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
    default:
      return 'png';
  }
}

function stripExt(name: string): string {
  return name.replace(/\.[^./]+$/, '');
}

/**
 * Encode `source`, flattened onto white when `type` is JPEG (no alpha channel),
 * otherwise drawn at the target size. Matches drawToBlob but lets JPEG output
 * put a white backdrop behind transparency instead of black.
 */
async function encodePass(
  source: ImageBitmap,
  width: number,
  height: number,
  type: string,
  quality: number | undefined,
  mode: string,
): Promise<Blob> {
  const canvas = canvasFor(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ToolError('Your browser could not create a 2D drawing context.');
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  if (mode === 'fill') {
    const scale = Math.max(width / source.width, height / source.height);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const sx = (source.width - cropWidth) / 2;
    const sy = (source.height - cropHeight) / 2;
    ctx.drawImage(source, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
  } else {
    ctx.drawImage(source, 0, 0, width, height);
  }
  const blob = await canvas.convertToBlob({ type, quality });
  if (blob.type !== type) {
    throw new ToolError(
      `This browser could not encode ${type.replace('image/', '').toUpperCase()}.`,
      'Try PNG or another supported format.',
    );
  }
  return blob;
}

/** A flavour of the tool that resizes and may transcode at the same time. */
async function processOne(
  file: File,
  opts: OptionValues,
  signal: AbortSignal | undefined,
  onProgress: ((f: number, m?: string) => void) | undefined,
): Promise<OutputFile & { table: string[] }> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onProgress?.(0 / 1, `Reading ${file.name}`);
  const bitmap = await decodeImage(file);
  try {
    const o = resolveOptions(meta, opts);
    const mode = String(o.mode ?? 'fit');
    const format = String(o.format ?? 'original');
    const target = computeTargetSize(bitmap.width, bitmap.height, {
      mode,
      width: Number(o.width ?? 800),
      height: Number(o.height ?? 600),
      percent: Number(o.percent ?? 50),
      upscale: Boolean(o.upscale),
    });

    const requestedType = MIME[format] || file.type || 'image/png';
    const type = ['image/png', 'image/jpeg', 'image/webp'].includes(requestedType)
      ? requestedType
      : 'image/png';
    const useQuality = type === 'image/jpeg' || type === 'image/webp';
    const quality = useQuality ? clamp(Number(o.quality ?? 90), 10, 100) / 100 : undefined;

    const blob = await encodePass(bitmap, target.width, target.height, type, quality, mode);
    const outputExt = extForMime(blob.type);

    const outName = `${stripExt(file.name)}-${target.width}x${target.height}.${outputExt}`;
    return {
      filename: outName,
      blob,
      table: [
        file.name,
        `${bitmap.width}×${bitmap.height}`,
        target.limited || (target.width === bitmap.width && target.height === bitmap.height)
          ? 'unchanged'
          : `${target.width}×${target.height}`,
        formatBytes(file.size),
        formatBytes(blob.size),
      ],
    };
  } finally {
    bitmap.close();
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, options, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one image file.');

  const outputs: OutputFile[] = [];
  const rows: string[][] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i / files.length, `Processing ${files[i]!.name}`);
    const r = await processOne(files[i]!, options, signal, onProgress);
    outputs.push({ filename: r.filename, blob: r.blob });
    rows.push(r.table);
    totalIn += files[i]!.size;
    totalOut += r.blob.size;
  }
  onProgress?.((files.length - 1) / files.length + 0.5 / files.length, 'Done');

  const savedPct =
    totalIn > 0 ? Math.max(-999, Math.round((1 - totalOut / totalIn) * 100)) : 0;
  const warnings: string[] = [];
  if (rows.some((r) => r[2] === 'unchanged')) {
    warnings.push(
      'Some images were already below the target size and upscaling is off, so they were left unchanged.',
    );
  }
  // Converted formats re-encode (and drop metadata) — alert only when the
  // user explicitly changed format, since "keep original" mostly round-trips.
  const merged = resolveOptions(meta, options);
  if (String(merged.format ?? 'original') !== 'original') {
    warnings.push(
      'Changing the format re-encodes the pixels and drops embedded metadata (EXIF/GPS); it also may not preserve transparency when converting to JPEG.',
    );
  }

  return {
    outputs,
    report: {
      output: JSON.stringify({
        headers: ['File', 'Original', 'Result', 'In', 'Out'],
        rows,
      }),
      render: 'table',
    },
    warnings: warnings.length ? warnings : undefined,
    stats: {
      files: files.length,
      'input size': formatBytes(totalIn),
      'output size': formatBytes(totalOut),
      saved: savedPct >= 0 ? `${savedPct}%` : `${-savedPct}% larger`,
    },
  };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${UNITS[i]}`;
}

const tool = { meta, run };
export default tool;
