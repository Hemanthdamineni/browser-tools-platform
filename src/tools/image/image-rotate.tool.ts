import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles, outputMime, extension, stem } from './common';
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
    throw new ToolError(
      'The rotation angle is not a number.',
      'Choose 0, 90, 180 or 270 degrees.',
    );
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

  const rotate = normalizeRotation(o.rotate);
  const scale = flipScale(o.flip);
  const outputs: FileRunResult['outputs'] = [];

  for (let i = 0; i < input.files.length; i++) {
    checkAbort(input.signal);
    const file = input.files[i]!;
    input.onProgress?.(i / input.files.length, `Rotating ${file.name}`);

    const bitmap = await decodeImage(file);
    try {
      const size = outputSize(bitmap.width, bitmap.height, rotate);
      const mime = outputMime(o.format, file.type);
      const canvas = canvasFor(size.w, size.h);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new ToolError(
          'Your browser could not create a 2D drawing context.',
          'Try a recent Chrome, Edge, Firefox or Safari.',
        );
      }

      // Rotate/mirror about the centre so the image always fills the output.
      ctx.translate(size.w / 2, size.h / 2);
      if (rotate !== 0) ctx.rotate((rotate * Math.PI) / 180);
      if (scale.x !== 1 || scale.y !== 1) ctx.scale(scale.x, scale.y);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

      const blob = await canvas.convertToBlob({ type: mime });
      if (blob.type !== mime) {
        throw new ToolError(
          `This browser cannot encode ${mime.replace('image/', '')}.`,
          'Try PNG or WebP.',
        );
      }
      outputs.push({ filename: `${stem(file.name)}-rotated.${extension(mime)}`, blob });
    } finally {
      bitmap.close();
    }
  }

  input.onProgress?.(1, 'Done');
  return { outputs, stats: { files: outputs.length } };
}

const tool: FileToolModule = { meta, run };
export default tool;
