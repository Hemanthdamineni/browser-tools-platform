import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles } from './common';
import { meta } from './image-diff.meta';
export function comparePixels(
  a: Uint8ClampedArray | number[],
  b: Uint8ClampedArray | number[],
  threshold: number,
) {
  const n = Math.min(a.length, b.length) / 4;
  let differing = 0,
    sum = 0,
    max = 0;
  const deltas: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = Math.max(
      Math.abs(a[i * 4]! - b[i * 4]!),
      Math.abs(a[i * 4 + 1]! - b[i * 4 + 1]!),
      Math.abs(a[i * 4 + 2]! - b[i * 4 + 2]!),
    );
    deltas.push(d);
    sum += d;
    max = Math.max(max, d);
    if (d > threshold * 2.55) differing++;
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
async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (input.files.length !== 2) throw new ToolError('Choose exactly two images to compare.');
  checkFiles(input.files, true);
  checkAbort(input.signal);
  input.onProgress?.(0, 'Decoding images');
  const a = await decodeImage(input.files[0]!);
  const b = await decodeImage(input.files[1]!);
  try {
    const w = a.width,
      h = a.height,
      c1 = canvasFor(w, h),
      c2 = canvasFor(w, h),
      x1 = c1.getContext('2d', { willReadFrequently: true }),
      x2 = c2.getContext('2d', { willReadFrequently: true });
    if (!x1 || !x2) throw new ToolError('Could not create a drawing context.');
    x1.drawImage(a, 0, 0, w, h);
    x2.drawImage(b, 0, 0, w, h);
    const pa = x1.getImageData(0, 0, w, h).data,
      pb = x2.getImageData(0, 0, w, h).data,
      comparison = comparePixels(pa, pb, Number(o.threshold));
    const output = String(o.output);
    let outW = w,
      outH = h;
    if (output === 'side-by-side') outW = w * 2;
    const out = canvasFor(outW, outH),
      ctx = out.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');
    if (output === 'side-by-side') {
      ctx.drawImage(a, 0, 0);
      ctx.drawImage(b, w, 0);
    } else {
      ctx.drawImage(a, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < comparison.deltas.length; i++) {
        const d = comparison.deltas[i]!;
        const j = i * 4;
        if (output === 'heatmap') {
          image.data[j] = 255;
          image.data[j + 1] = 0;
          image.data[j + 2] = 0;
          image.data[j + 3] = d;
        } else if (d > Number(o.threshold) * 2.55) {
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
        a.width !== b.width || a.height !== b.height
          ? ['The second image was scaled to the first image dimensions for comparison.']
          : undefined,
      stats: {
        pixels: comparison.pixels,
        differing: comparison.differing,
        percent: Math.round(comparison.percent * 100) / 100,
      },
    };
  } finally {
    a.close();
    b.close();
  }
}
const tool: FileToolModule = { meta, run };
export default tool;
