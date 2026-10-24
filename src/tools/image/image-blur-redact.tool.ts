/**
 * Image Blur & Redact — burns blur, pixelation or solid black into the pixels
 * of user-drawn rectangles and re-encodes the image in the Web Worker.
 *
 * The pixel maths lives in `image-blur-redact.core.ts` (pure, unit-tested); this
 * module only decodes, calls it and encodes, so the heavy work never touches the
 * main thread and the drawing UI stays responsive.
 */
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
import {
  NOTHING_TO_REDACT,
  applyRegions,
  parseEffect,
  parseParams,
  parseRegions,
  planRegions,
  type RedactEffect,
  type RedactParams,
} from './image-blur-redact.core';
import { meta } from './image-blur-redact.meta';

/** How the exported file describes one region in the report table. */
function effectLabel(effect: RedactEffect, params: RedactParams): string {
  if (effect === 'blur') return `Blur, radius ${params.radius}px`;
  if (effect === 'pixelate') return `Pixelate, ${params.cellSize}px cells`;
  return params.opacity >= 1
    ? 'Black (#000)'
    : `Black (#000), ${Math.round(params.opacity * 100)}% opacity`;
}

/** Quality as a 0–1 fraction for `convertToBlob`, or `undefined` for PNG. */
function qualityFraction(value: unknown): number | undefined {
  const percent = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(percent)) return undefined;
  const clamped = Math.min(100, Math.max(1, percent));
  return clamped / 100;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const effect = parseEffect(o.effect, 'blur');
  const params = parseParams(o);
  const regions = parseRegions(o.regions);
  if (!regions.length) {
    throw new ToolError(
      NOTHING_TO_REDACT,
      'Draw at least one rectangle over the image, then run the tool again.',
    );
  }

  const mime = outputMime(o.format, 'image/png');
  const quality = mime === 'image/png' ? undefined : qualityFraction(o.quality);

  const rows: string[][] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  let redactedPixels = 0;
  let outputBytes = 0;

  const outputs = await runBatch(input.files, input, 'Redacting', async (file) => {
    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'image');
      // Resolve the percentages against the real, EXIF-corrected size. Regions
      // that fall outside the image are reported rather than silently padded.
      const plan = planRegions(regions, bitmap.width, bitmap.height, effect);
      for (const line of plan.skipped) warnings.push(`${file.name}: ${line}`);

      const canvas = createCanvas(bitmap.width, bitmap.height, 'output');
      const ctx = context2d(canvas);
      // Flatten first: `putImageData` replaces pixels, so a JPEG export would
      // otherwise lose the white backdrop under any transparent areas.
      flattenForJpeg(ctx, mime, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);

      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const outcome = applyRegions(image.data, canvas.width, canvas.height, plan.regions, params);
      ctx.putImageData(image, 0, 0);

      input.onProgress?.(0.5, `Encoding ${canvas.width}×${canvas.height}`);
      const blob = await encodeCanvas(canvas, mime, quality);
      outputBytes += blob.size;
      redactedPixels += outcome.touchedPixels;

      for (const region of plan.regions) {
        const source = regions[region.index]!;
        rows.push([
          `${region.index + 1}`,
          effectLabel(region.effect, params),
          `x ${source.x}%, y ${source.y}% · ${region.w}×${region.h}px`,
          (region.w * region.h).toLocaleString(),
        ]);
      }

      return { filename: `${stem(file.name)}-redacted.${extension(mime)}`, blob };
    } finally {
      bitmap.close();
    }
  });

  const applied = rows.length;
  notes.push(
    `Exports were redrawn from pixels: EXIF, GPS, XMP, IPTC, the ICC colour profile and comments were dropped.`,
  );
  notes.push(
    'The redaction is baked into the exported pixels — there is no layer, mask or original data to recover.',
  );
  if (!applied) notes.push('No region inside the image was redacted.');

  return {
    outputs,
    report: {
      output: JSON.stringify({
        headers: ['Region', 'Effect', 'Position · size', 'Pixels'],
        rows: rows.length ? rows : [['—', 'No region inside the image', '—', '0']],
      }),
      render: 'table',
    },
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      files: outputs.length,
      regions: applied,
      redactedPixels,
      outputBytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
