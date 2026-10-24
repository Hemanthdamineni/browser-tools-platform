/**
 * Image Filters — applies brightness, contrast, saturation, grayscale, sepia and
 * sharpen to an image and re-encodes it in the Web Worker.
 *
 * The pixel maths lives in `image-filters.core.ts` (pure and unit-tested); the
 * panel's live preview calls the very same functions, so the export always
 * matches what the user saw. This module only decodes, calls the pipeline on the
 * full-resolution pixels and encodes, keeping the heavy loop off the main thread.
 */
import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, outputMime, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  flattenForJpeg,
  runBatch,
} from './image-batch';
import { applyFilters, describeParams, isNeutral, parseParams } from './image-filters.core';
import { meta } from './image-filters.meta';

/** Quality as a 0–1 fraction for `convertToBlob`, or `undefined` for PNG. */
function qualityFraction(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0.1, n / 100));
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const params = parseParams(o);
  const format = String(o.format ?? 'original');
  const quality = qualityFraction(o.quality);
  const neutral = isNeutral(params);

  const notes: string[] = [];
  let inputBytes = 0;
  let outputBytes = 0;
  let pixelsProcessed = 0;
  let width = 0;
  let height = 0;

  const outputs = await runBatch(input.files, input, 'Filtering', async (file) => {
    inputBytes += file.size;
    // Match the source MIME for "original"; the encoder still validates it.
    const mime = outputMime(format, file.type);
    const q = mime === 'image/png' ? undefined : quality;

    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'image');
      width = bitmap.width;
      height = bitmap.height;

      const canvas = createCanvas(bitmap.width, bitmap.height, 'output');
      const ctx = context2d(canvas);
      // JPEG has no alpha: flatten onto white first so transparent areas do not
      // turn black when the pixels are replaced by `putImageData`.
      flattenForJpeg(ctx, mime, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);

      if (!neutral) {
        input.onProgress?.(0.35, `Filtering ${canvas.width}×${canvas.height}`);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyFilters(image.data, canvas.width, canvas.height, params);
        ctx.putImageData(image, 0, 0);
        pixelsProcessed += canvas.width * canvas.height;
      }

      input.onProgress?.(0.7, 'Encoding');
      const blob = await encodeCanvas(canvas, mime, q);
      outputBytes += blob.size;
      return { filename: `${stem(file.name)}-filtered.${extension(mime)}`, blob };
    } finally {
      bitmap.close();
    }
  });

  notes.push(`Adjustments: ${describeParams(params)}.`);
  if (neutral) {
    notes.push('No adjustments were selected, so the image was re-encoded unchanged.');
  } else {
    notes.push(
      'The filter is baked into the exported pixels — it is a real change, not a preview overlay.',
    );
  }
  notes.push(
    'Re-encoding drops EXIF, GPS and XMP metadata; the ICC profile and source dimensions are kept.',
  );

  return {
    outputs,
    notes,
    stats: {
      files: outputs.length,
      width,
      height,
      filteredPixels: pixelsProcessed,
      inputBytes,
      outputBytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
