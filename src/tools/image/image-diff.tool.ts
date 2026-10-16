import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles } from './common';
import { meta } from './image-diff.meta';

export interface PixelComparison {
  pixels: number;
  differing: number;
  percent: number;
  mean: number;
  max: number;
  deltas: number[];
}

/**
 * Compare two RGBA buffers pixel by pixel on the RGB channels. A pixel counts
 * as different when its largest channel delta exceeds `threshold`% (0–100).
 */
export function comparePixels(
  a: Uint8ClampedArray | number[],
  b: Uint8ClampedArray | number[],
  threshold: number,
): PixelComparison {
  const n = Math.floor(Math.min(a.length, b.length) / 4);
  const cutoff = threshold * 2.55;
  let differing = 0;
  let sum = 0;
  let max = 0;
  const deltas: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.max(
      Math.abs(a[o]! - b[o]!),
      Math.abs(a[o + 1]! - b[o + 1]!),
      Math.abs(a[o + 2]! - b[o + 2]!),
    );
    deltas.push(d);
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
    deltas,
  };
}

const VISUALISATIONS = new Set(['heatmap', 'highlight', 'side-by-side']);

async function run(input: FileRunInput): Promise<FileRunResult> {
  if (input.files.length !== 2) throw new ToolError('Choose exactly two images to compare.');
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  checkAbort(input.signal);
  input.onProgress?.(0, 'Decoding images');

  const first = await decodeImage(input.files[0]!);
  let second: ImageBitmap | null = null;
  try {
    second = await decodeImage(input.files[1]!);
    const w = first.width;
    const h = first.height;
    const threshold = Number(o.threshold);
    const output = VISUALISATIONS.has(String(o.output)) ? String(o.output) : 'heatmap';
    const cutoff = threshold * 2.55;

    // Both images are drawn into identically-sized canvases so mismatched
    // dimensions still compare pixel-for-pixel (the second is scaled to fit).
    const canvasA = canvasFor(w, h);
    const canvasB = canvasFor(w, h);
    const ctxA = canvasA.getContext('2d', { willReadFrequently: true });
    const ctxB = canvasB.getContext('2d', { willReadFrequently: true });
    if (!ctxA || !ctxB) throw new ToolError('Could not create a drawing context.');
    ctxA.drawImage(first, 0, 0, w, h);
    ctxB.drawImage(second, 0, 0, w, h);
    const comparison = comparePixels(
      ctxA.getImageData(0, 0, w, h).data,
      ctxB.getImageData(0, 0, w, h).data,
      threshold,
    );

    const out = canvasFor(output === 'side-by-side' ? w * 2 : w, h);
    const ctx = out.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');

    if (output === 'side-by-side') {
      ctx.drawImage(first, 0, 0, w, h);
      ctx.drawImage(second, w, 0, w, h);
    } else {
      ctx.drawImage(first, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < comparison.deltas.length; i++) {
        const d = comparison.deltas[i]!;
        const j = i * 4;
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

    const blob = await out.convertToBlob({ type: 'image/png' });
    if (blob.type !== 'image/png') throw new ToolError('This browser could not encode a PNG.');

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

    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: 'image-diff.png', blob }],
      report: { output: JSON.stringify(table), render: 'table' },
      notes:
        first.width !== second.width || first.height !== second.height
          ? ['The second image was scaled to the first image dimensions for comparison.']
          : undefined,
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
