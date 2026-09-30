import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { readPixels, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles } from './common';
import { meta } from './image-palette.meta';

type ColorCount = { r: number; g: number; b: number; n: number };
type Channel = 'r' | 'g' | 'b';

/** Quantize RGBA pixels into representative hex colors. */
export function quantizePixels(
  pixels: Uint8ClampedArray | number[],
  count: number,
  algorithm = 'median-cut',
): string[] {
  const requested = Number.isFinite(count) ? Math.floor(count) : 6;
  const limit = Math.max(1, Math.min(16, requested));
  const hist = new Map<string, ColorCount>();

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 32) continue;
    const r = Math.min(255, Math.max(0, Math.round(pixels[i]! / 16) * 16));
    const g = Math.min(255, Math.max(0, Math.round(pixels[i + 1]! / 16) * 16));
    const b = Math.min(255, Math.max(0, Math.round(pixels[i + 2]! / 16) * 16));
    const key = `${r},${g},${b}`;
    const color = hist.get(key);
    if (color) color.n++;
    else hist.set(key, { r, g, b, n: 1 });
  }

  const colors = [...hist.values()];
  if (!colors.length) return [];

  let selected: ColorCount[];
  if (algorithm === 'most-frequent' || algorithm === 'k-means') {
    // Keep the established frequency-based approximation for both modes.
    selected = colors.sort((a, b) => b.n - a.n).slice(0, limit);
  } else {
    const channels: Channel[] = ['r', 'g', 'b'];
    let channel: Channel = 'r';
    let largestRange = -1;
    for (const candidate of channels) {
      let min = 255;
      let max = 0;
      for (const color of colors) {
        min = Math.min(min, color[candidate]);
        max = Math.max(max, color[candidate]);
      }
      if (max - min > largestRange) {
        largestRange = max - min;
        channel = candidate;
      }
    }

    const sorted = [...colors].sort((a, b) => a[channel] - b[channel]);
    selected = [];
    for (let i = 0; i < limit; i++) {
      const start = Math.floor((i * sorted.length) / limit);
      const end = Math.max(start + 1, Math.floor(((i + 1) * sorted.length) / limit));
      const slice = sorted.slice(start, end);
      if (!slice.length) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let total = 0;
      for (const color of slice) {
        r += color.r * color.n;
        g += color.g * color.n;
        b += color.b * color.n;
        total += color.n;
      }
      selected.push({ r: Math.round(r / total), g: Math.round(g / total), b: Math.round(b / total), n: total });
    }
  }

  return selected.map((color) => `#${[color.r, color.g, color.b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`);
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  checkFiles(input.files);
  const file = input.files[0]!;
  checkAbort(input.signal);
  input.onProgress?.(0, 'Sampling image');
  const bitmap = await decodeImage(file);
  try {
    checkAbort(input.signal);
    const pixels = readPixels(bitmap, 10_000);
    const colors = quantizePixels(pixels, Number(options.colors), String(options.algorithm));
    const count = Math.floor(pixels.length / 4);
    let light = 0;
    for (let i = 0; i + 3 < pixels.length; i += 4) {
      if (pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722 > 127) light++;
    }
    input.onProgress?.(1, 'Done');
    return {
      outputs: [],
      report: { output: JSON.stringify(colors), render: 'colors' },
      stats: {
        dominant: colors[0] ?? 'none',
        appearance: light > count / 2 ? 'mostly light' : 'mostly dark',
        sampledPixels: count,
      },
    };
  } finally {
    bitmap.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
