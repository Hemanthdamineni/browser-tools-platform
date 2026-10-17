import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  throwIfAborted,
} from './image-batch';
import { meta } from './image-diff.meta';

export interface PixelComparison {
  pixels: number;
  differing: number;
  percent: number;
  mean: number;
  max: number;
}

/**
 * Largest absolute per-channel delta (including alpha) between two RGBA pixels,
 * so a change in transparency is a difference too.
 */
export function pixelDelta(
  a: Uint8ClampedArray | number[],
  b: Uint8ClampedArray | number[],
  offset: number,
): number {
  return Math.max(
    Math.abs(a[offset]! - b[offset]!),
    Math.abs(a[offset + 1]! - b[offset + 1]!),
    Math.abs(a[offset + 2]! - b[offset + 2]!),
    Math.abs(a[offset + 3]! - b[offset + 3]!),
  );
}

/**
 * Compare two RGBA buffers pixel by pixel. A pixel counts as different when its
 * largest channel delta exceeds `threshold`% (0–100). Deltas are summarised on
 * the fly rather than stored, so a large image does not allocate a second array
 * of the same size.
 */
export function comparePixels(
  a: Uint8ClampedArray | number[],
  b: Uint8ClampedArray | number[],
  threshold: number,
): PixelComparison {
  const n = Math.floor(Math.min(a.length, b.length) / 4);
  const cutoff = (Math.max(0, Math.min(100, threshold)) * 255) / 100;
  let differing = 0;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const d = pixelDelta(a, b, i * 4);
    sum += d;
    if (d > max) max = d;
    if (d > cutoff) differing++;
  }
  return {
    pixels: n,
    differing,
    percent: n ? (differing / n) * 100 : 0,
    mean: n ? sum / n : 0,
    max,
  };
}

const VISUALISATIONS = new Set(['heatmap', 'highlight', 'side-by-side']);

async function run(input: FileRunInput): Promise<FileRunResult> {
  if (input.files.length !== 2) {
    throw new ToolError(
      `Choose exactly two images to compare (you selected ${input.files.length}).`,
    );
  }
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  throwIfAborted(input.signal);
  input.onProgress?.(0, 'Decoding images');

  const first = await decodeOriented(input.files[0]!);
  let second: ImageBitmap | null = null;
  try {
    second = await decodeOriented(input.files[1]!);
    const w = first.width;
    const h = first.height;
    assertCanvasBudget(w, h, 'first image');
    assertCanvasBudget(second.width, second.height, 'second image');

    const threshold = Math.max(0, Math.min(100, Number(o.threshold) || 0));
    const output = VISUALISATIONS.has(String(o.output)) ? String(o.output) : 'heatmap';
    const cutoff = (threshold * 255) / 100;

    // Both images are drawn into identically-sized canvases so mismatched
    // dimensions still compare pixel-for-pixel (the second is scaled to fit).
    input.onProgress?.(0.3, 'Comparing pixels');
    const canvasA = createCanvas(w, h, 'comparison canvas');
    const canvasB = createCanvas(w, h, 'comparison canvas');
    const ctxA = context2d(canvasA);
    const ctxB = context2d(canvasB);
    ctxA.drawImage(first, 0, 0, w, h);
    ctxB.drawImage(second, 0, 0, w, h);
    const dataA = ctxA.getImageData(0, 0, w, h).data;
    const dataB = ctxB.getImageData(0, 0, w, h).data;
    const comparison = comparePixels(dataA, dataB, threshold);

    input.onProgress?.(0.7, 'Rendering difference');
    const out = createCanvas(output === 'side-by-side' ? w * 2 : w, h, 'diff image');
    const ctx = context2d(out);

    if (output === 'side-by-side') {
      ctx.drawImage(first, 0, 0, w, h);
      ctx.drawImage(second, w, 0, w, h);
    } else {
      ctx.drawImage(first, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < comparison.pixels; i++) {
        const j = i * 4;
        const d = pixelDelta(dataA, dataB, j);
        if (output === 'heatmap') {
          image.data[j] = 255;
          image.data[j + 1] = 0;
          image.data[j + 2] = 0;
          image.data[j + 3] = d;
        } else if (d > cutoff) {
          image.data[j] = 255;
          image.data[j + 1] = 0;
          image.data[j + 2] = 255;
          image.data[j + 3] = 255;
        } else {
          image.data[j] = Math.round(image.data[j]! * 0.35);
          image.data[j + 1] = Math.round(image.data[j + 1]! * 0.35);
          image.data[j + 2] = Math.round(image.data[j + 2]! * 0.35);
        }
      }
      ctx.putImageData(image, 0, 0);
    }

    const blob = await encodeCanvas(out, 'image/png');

    const table = {
      headers: ['Metric', 'Value'],
      rows: [
        ['Total pixels', String(comparison.pixels)],
        ['Differing pixels', String(comparison.differing)],
        ['Different (%)', comparison.percent.toFixed(2)],
        ['Mean channel delta', comparison.mean.toFixed(2)],
        ['Maximum channel delta', String(comparison.max)],
        ['Identical', comparison.differing === 0 ? 'Yes' : 'No'],
      ],
    };

    const mismatched = first.width !== second.width || first.height !== second.height;
    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: 'image-diff.png', blob }],
      report: { output: JSON.stringify(table), render: 'table' },
      notes: [
        ...(mismatched
          ? ['The second image was scaled to the first image dimensions for comparison.']
          : []),
        'All four RGBA channels are compared, so transparency changes count.',
      ],
      stats: {
        pixels: comparison.pixels,
        differing: comparison.differing,
        percent: Math.round(comparison.percent * 100) / 100,
      },
    };
  } finally {
    first.close();
    second?.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
