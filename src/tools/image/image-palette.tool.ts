import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { readPixels } from '@/lib/image';
import { checkFiles } from './common';
import { assertCanvasBudget, decodeOriented, runBatch } from './image-batch';
import { meta } from './image-palette.meta';

export const ALGORITHMS = ['median-cut', 'k-means', 'most-frequent'] as const;
export type PaletteAlgorithm = (typeof ALGORITHMS)[number];

type RGB = { r: number; g: number; b: number };
type ColorCount = RGB & { n: number };
type Channel = 'r' | 'g' | 'b';

const CHANNELS: Channel[] = ['r', 'g', 'b'];

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/** Format an (averaged) colour as a lowercase `#rrggbb` hex string. */
export function hexColor(color: RGB): string {
  return `#${[color.r, color.g, color.b]
    .map((v) => clampByte(Math.round(v)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Histogram the RGBA pixels into 16-level colour buckets, discarding
 * near-transparent pixels (alpha < 32). Source RGB values are rounded to the
 * nearest 16 and clamped to 255, so the palette stays tidy.
 */
function toColorCounts(pixels: Uint8ClampedArray | number[]): ColorCount[] {
  const hist = new Map<string, ColorCount>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 32) continue;
    const r = clampByte(Math.round(pixels[i]! / 16) * 16);
    const g = clampByte(Math.round(pixels[i + 1]! / 16) * 16);
    const b = clampByte(Math.round(pixels[i + 2]! / 16) * 16);
    const key = `${r},${g},${b}`;
    const existing = hist.get(key);
    if (existing) existing.n++;
    else hist.set(key, { r, g, b, n: 1 });
  }
  return [...hist.values()];
}

/** Range of one channel across a set of colours. */
function channelRange(colors: ColorCount[], channel: Channel): number {
  let min = 255;
  let max = 0;
  for (const color of colors) {
    const v = color[channel];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

/** Frequency-weighted average of a set of colours. */
function averageColors(colors: ColorCount[]): ColorCount {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const color of colors) {
    r += color.r * color.n;
    g += color.g * color.n;
    b += color.b * color.n;
    total += color.n;
  }
  if (!total) return { r: 0, g: 0, b: 0, n: 0 };
  return { r: r / total, g: g / total, b: b / total, n: total };
}

/**
 * Median-cut: repeatedly split the box with the widest colour range at its
 * (weighted) median along that channel, then average each box. More accurate
 * than taking the most frequent buckets because each representative sits at
 * the centre of a colour region rather than on a single popular value.
 */
function medianCut(colors: ColorCount[], limit: number): ColorCount[] {
  const boxes: ColorCount[][] = [colors];
  while (boxes.length < limit) {
    let target = -1;
    let bestRange = 0;
    let bestChannel: Channel = 'r';
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      for (const channel of CHANNELS) {
        const range = channelRange(box, channel);
        if (range > bestRange) {
          bestRange = range;
          target = index;
          bestChannel = channel;
        }
      }
    });
    if (target === -1) break; // every box is a single colour

    const box = boxes[target]!;
    const sorted = [...box].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const total = sorted.reduce((sum, color) => sum + color.n, 0);
    let acc = 0;
    let split = 1;
    for (let i = 0; i < sorted.length; i++) {
      acc += sorted[i]!.n;
      if (acc * 2 >= total) {
        split = i + 1;
        break;
      }
    }
    split = Math.max(1, Math.min(sorted.length - 1, split));
    boxes.splice(target, 1, sorted.slice(0, split), sorted.slice(split));
  }
  return boxes.map(averageColors).sort((a, b) => b.n - a.n);
}

/** Small deterministic PRNG so k-means clustering is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * k-means over the colour buckets (weighted by pixel count). Centroids are
 * seeded with k-means++ using a fixed PRNG, so the palette is stable across
 * runs and platforms.
 */
function kMeans(colors: ColorCount[], limit: number): ColorCount[] {
  const k = Math.min(limit, colors.length);
  if (k <= 0) return [];
  if (k === 1) return [averageColors(colors)];

  const dist2 = (a: RGB, b: RGB): number =>
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
  const random = mulberry32(0x9e3779b9);

  const first = [...colors].sort((a, b) => b.n - a.n)[0]!;
  const centroids: RGB[] = [{ r: first.r, g: first.g, b: first.b }];
  while (centroids.length < k) {
    const weights = colors.map((color) =>
      Math.min(...centroids.map((centroid) => dist2(centroid, color))),
    );
    const total = weights.reduce((sum, w) => sum + w, 0);
    let target = random() * total;
    let index = 0;
    for (; index < colors.length - 1; index++) {
      target -= weights[index]!;
      if (target <= 0) break;
    }
    const chosen = colors[index]!;
    centroids.push({ r: chosen.r, g: chosen.g, b: chosen.b });
  }

  const nearest = (color: RGB): number => {
    let best = 0;
    let bestDistance = Infinity;
    centroids.forEach((centroid, i) => {
      const d = dist2(centroid, color);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return best;
  };

  for (let iteration = 0; iteration < 16; iteration++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const color of colors) {
      const s = sums[nearest(color)]!;
      s.r += color.r * color.n;
      s.g += color.g * color.n;
      s.b += color.b * color.n;
      s.n += color.n;
    }
    for (let i = 0; i < centroids.length; i++) {
      const s = sums[i]!;
      if (s.n > 0) centroids[i] = { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n };
    }
  }

  const clusters = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
  for (const color of colors) {
    const cluster = clusters[nearest(color)]!;
    cluster.r += color.r * color.n;
    cluster.g += color.g * color.n;
    cluster.b += color.b * color.n;
    cluster.n += color.n;
  }
  return clusters
    .filter((cluster) => cluster.n > 0)
    .map((cluster) => ({
      r: cluster.r / cluster.n,
      g: cluster.g / cluster.n,
      b: cluster.b / cluster.n,
      n: cluster.n,
    }))
    .sort((a, b) => b.n - a.n);
}

/**
 * Quantize RGBA pixels into representative hex colours. `count` is clamped to
 * 1–16 and unknown algorithms fall back to median-cut.
 */
export function quantizePixels(
  pixels: Uint8ClampedArray | number[],
  count: number,
  algorithm = 'median-cut',
): string[] {
  const requested = Number.isFinite(count) ? Math.floor(count) : 6;
  const limit = Math.max(1, Math.min(16, requested));
  const colors = toColorCounts(pixels);
  if (!colors.length) return [];

  let selected: ColorCount[];
  if (algorithm === 'most-frequent') {
    selected = [...colors].sort((a, b) => b.n - a.n).slice(0, limit);
  } else if (algorithm === 'k-means') {
    selected = kMeans(colors, limit);
  } else {
    selected = medianCut(colors, limit);
  }
  return selected.map(hexColor);
}

/** Analysis of one sampled image: palette plus appearance statistics. */
interface ImageAnalysis {
  palette: string[];
  opaque: number;
  light: number;
  sampledPixels: number;
}

/** Sample a decoded bitmap into a palette and luminance statistics. */
function analyze(bitmap: ImageBitmap, count: number, algorithm: string): ImageAnalysis {
  const pixels = readPixels(bitmap, 10_000);
  const palette = quantizePixels(pixels, count, algorithm);

  let light = 0;
  let opaque = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 32) continue;
    opaque++;
    const luminance = pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722;
    if (luminance > 127) light++;
  }

  return { palette, opaque, light, sampledPixels: Math.floor(pixels.length / 4) };
}

function appearance(analysis: ImageAnalysis): string {
  if (analysis.opaque === 0) return 'no opaque pixels';
  return analysis.light > analysis.opaque / 2 ? 'mostly light' : 'mostly dark';
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const algorithm = String(options.algorithm ?? 'median-cut');
  if (!(ALGORITHMS as readonly string[]).includes(algorithm)) {
    throw new ToolError('Unknown palette algorithm.', `Choose one of: ${ALGORITHMS.join(', ')}.`);
  }
  const count = Number(options.colors);

  const analyses = await runBatch(input.files, input, 'Sampling', async (file) => {
    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'image');
      return analyze(bitmap, count, algorithm);
    } finally {
      bitmap.close();
    }
  });

  // A single image keeps the swatch render; several files become one table.
  if (analyses.length === 1) {
    const analysis = analyses[0]!;
    return {
      outputs: [],
      report: { output: JSON.stringify(analysis.palette), render: 'colors' },
      stats: {
        dominant: analysis.palette[0] ?? 'none',
        appearance: appearance(analysis),
        sampledPixels: analysis.sampledPixels,
      },
    };
  }

  const rows = analyses.map((analysis, index) => [
    input.files[index]!.name,
    analysis.palette[0] ?? 'none',
    analysis.palette.length ? analysis.palette.join(', ') : '—',
  ]);
  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['File', 'Dominant', 'Palette'], rows }),
      render: 'table',
    },
    stats: { files: analyses.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
