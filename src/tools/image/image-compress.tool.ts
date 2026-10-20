import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  flattenForJpeg,
  runBatch,
} from './image-batch';
import { meta } from './image-compress.meta';

export interface TargetSize {
  width: number;
  height: number;
}

/** Downscale to `maxWidth` (0 = keep) while preserving the aspect ratio. */
export function compressTarget(srcW: number, srcH: number, maxWidth: unknown): TargetSize {
  const cap = Number(maxWidth);
  const width = Number.isFinite(cap) && cap > 0 ? Math.min(srcW, Math.floor(cap)) : srcW;
  const height = srcH * (width / srcW);
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/** Choose the output MIME: explicit format, or JPEG for JPEG sources and WebP otherwise. */
export function compressMime(format: string, sourceType: string): string {
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return sourceType === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const format = String(o.format ?? 'auto');
  const maxWidth = o.maxWidth;
  const quality = Math.min(100, Math.max(10, Number(o.quality) || 75)) / 100;
  const stripMetadata = o.stripMetadata !== false;

  const warnings: string[] = [];
  let originalBytes = 0;
  let outputBytes = 0;

  const outputs = await runBatch(input.files, input, 'Compressing', async (file) => {
    originalBytes += file.size;
    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
      const size = compressTarget(bitmap.width, bitmap.height, maxWidth);
      const mime = compressMime(format, file.type);
      const canvas = createCanvas(size.width, size.height);
      const ctx = context2d(canvas);
      flattenForJpeg(ctx, mime, size.width, size.height);
      ctx.drawImage(bitmap, 0, 0, size.width, size.height);

      let blob = await encodeCanvas(canvas, mime, quality);
      let filename = `${stem(file.name)}-min.${extension(mime)}`;
      if (blob.size >= file.size) {
        warnings.push(
          `${file.name}: the re-encoded file was not smaller, so the original is kept.`,
        );
        blob = file;
        filename = file.name;
      }
      if (!stripMetadata) {
        warnings.push(`${file.name}: re-encoding always removes metadata; it cannot be preserved.`);
      }
      outputBytes += blob.size;
      return { filename, blob };
    } finally {
      bitmap.close();
    }
  });

  return {
    outputs,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      files: outputs.length,
      originalBytes,
      outputBytes,
      ratio: originalBytes ? Math.round((outputBytes / originalBytes) * 1000) / 1000 : 0,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
