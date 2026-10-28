import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
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
import { meta } from './image-rotate.meta';

/**
 * Coerce the rotation option to one of 0/90/180/270 degrees.
 *
 * Accepts numbers or numeric strings (the workbench stores select values as
 * strings) and normalises out-of-range multiples of 90 (e.g. `-90` → `270`,
 * `450` → `90`). Anything that is not a finite multiple of 90 is rejected with
 * a friendly `ToolError` rather than silently producing a wrong image.
 */
export function normalizeRotation(rotate: unknown): number {
  const deg = typeof rotate === 'number' ? rotate : Number(rotate);
  if (!Number.isFinite(deg)) {
    throw new ToolError('The rotation angle is not a number.', 'Choose 0, 90, 180 or 270 degrees.');
  }
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
    throw new ToolError(
      'Rotation must be a multiple of 90 degrees.',
      'Choose 0, 90, 180 or 270 degrees.',
    );
  }
  return normalized;
}

/** Output dimensions after rotating a `w × h` image by a 90° step. */
export function outputSize(w: number, h: number, rotate: unknown): { w: number; h: number } {
  const deg = normalizeRotation(rotate);
  return deg === 90 || deg === 270 ? { w: h, h: w } : { w, h };
}

/** Resolve the mirror option into a `{ x, y }` scale applied about the centre. */
export function flipScale(flip: unknown): { x: number; y: number } {
  const value = String(flip ?? 'none');
  return {
    x: value === 'horizontal' || value === 'both' ? -1 : 1,
    y: value === 'vertical' || value === 'both' ? -1 : 1,
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  // Validate once, before touching any pixels, so a bad angle fails fast.
  const rotate = normalizeRotation(o.rotate);
  const scale = flipScale(o.flip);

  let originalBytes = 0;
  let outputBytes = 0;
  const outputs = await runBatch(
    input.files,
    input,
    'Rotating',
    async (file): Promise<FileRunResult['outputs'][number]> => {
      originalBytes += file.size;
      const bitmap = await decodeOriented(file);
      try {
        assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
        const size = outputSize(bitmap.width, bitmap.height, rotate);
        const mime = outputMime(o.format, file.type);
        const canvas = createCanvas(size.w, size.h);
        const ctx = context2d(canvas);

        // JPEG has no alpha channel; flatten onto white before rotating so the
        // corners left by a quarter turn stay opaque. PNG/WebP keep transparency.
        flattenForJpeg(ctx, mime, size.w, size.h);

        // Rotate/mirror about the centre so the image always fills the output.
        ctx.translate(size.w / 2, size.h / 2);
        if (rotate !== 0) ctx.rotate((rotate * Math.PI) / 180);
        if (scale.x !== 1 || scale.y !== 1) ctx.scale(scale.x, scale.y);
        ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

        const blob = await encodeCanvas(canvas, mime);
        outputBytes += blob.size;
        return { filename: `${stem(file.name)}-rotated.${extension(mime)}`, blob };
      } finally {
        bitmap.close();
      }
    },
  );

  return {
    outputs,
    stats: {
      files: outputs.length,
      originalBytes,
      outputBytes,
      savedPercent: originalBytes ? Math.round((1 - outputBytes / originalBytes) * 1000) / 10 : 0,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
