/**
 * Image Filters — applies CSS filter effects and sharpening via canvas 2D context.
 * All processing happens locally in the Web Worker.
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
import { meta } from './image-filters.meta';

type SharpenLevel = 'none' | 'light' | 'medium' | 'strong';

interface FilterOptions {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  sepia: boolean;
  sharpen: SharpenLevel;
  format: string;
  quality: number;
}

/**
 * Build a CSS filter string from the parsed options.
 */
function buildFilterString(opts: FilterOptions): string {
  const filters: string[] = [];

  // brightness: -100 to 100 maps to 0% to 200%
  if (opts.brightness !== 0) {
    const value = 100 + opts.brightness; // -100 -> 0%, 0 -> 100%, 100 -> 200%
    filters.push(`brightness(${value}%)`);
  }

  // contrast: -100 to 100 maps to 0% to 200%
  if (opts.contrast !== 0) {
    const value = 100 + opts.contrast; // -100 -> 0%, 0 -> 100%, 100 -> 200%
    filters.push(`contrast(${value}%)`);
  }

  // saturation: 0 to 200 maps to 0% to 200%
  if (opts.saturation !== 100) {
    filters.push(`saturate(${opts.saturation}%)`);
  }

  // grayscale: boolean
  if (opts.grayscale) {
    filters.push('grayscale(100%)');
  }

  // sepia: boolean
  if (opts.sepia) {
    filters.push('sepia(100%)');
  }

  return filters.join(' ');
}

/**
 * Apply sharpening using unsharp masking technique.
 * Draws the image, blurs a copy, then blends the difference back.
 */
async function applySharpen(
  ctx: OffscreenCanvasRenderingContext2D,
  source: ImageBitmap,
  width: number,
  height: number,
  level: SharpenLevel,
): Promise<void> {
  if (level === 'none') {
    ctx.drawImage(source, 0, 0, width, height);
    return;
  }

  // Sharpening parameters based on level
  const params: Record<SharpenLevel, { radius: number; amount: number; threshold: number }> = {
    none: { radius: 0, amount: 0, threshold: 0 },
    light: { radius: 1, amount: 0.5, threshold: 2 },
    medium: { radius: 1.5, amount: 1, threshold: 3 },
    strong: { radius: 2, amount: 1.5, threshold: 4 },
  };

  const { radius, amount, threshold } = params[level];

  // Draw original to canvas
  ctx.drawImage(source, 0, 0, width, height);

  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const pixelCount = width * height;

  // Create a blurred version (simple box blur for sharpening)
  const blurred = new Uint8ClampedArray(pixels.length);
  const r = Math.max(1, Math.round(radius));
  const kernelSize = r * 2 + 1;
  const kernelArea = kernelSize * kernelSize;

  // Horizontal pass
  const horizontal = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (let kx = -r; kx <= r; kx++) {
        const sx = Math.max(0, Math.min(width - 1, x + kx));
        const sIdx = (y * width + sx) * 4;
        rSum += pixels[sIdx];
        gSum += pixels[sIdx + 1];
        bSum += pixels[sIdx + 2];
        aSum += pixels[sIdx + 3];
      }

      horizontal[idx] = rSum / kernelSize;
      horizontal[idx + 1] = gSum / kernelSize;
      horizontal[idx + 2] = bSum / kernelSize;
      horizontal[idx + 3] = aSum / kernelSize;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (let ky = -r; ky <= r; ky++) {
        const sy = Math.max(0, Math.min(height - 1, y + ky));
        const sIdx = (sy * width + x) * 4;
        rSum += horizontal[sIdx];
        gSum += horizontal[sIdx + 1];
        bSum += horizontal[sIdx + 2];
        aSum += horizontal[sIdx + 3];
      }

      blurred[idx] = rSum / kernelSize;
      blurred[idx + 1] = gSum / kernelSize;
      blurred[idx + 2] = bSum / kernelSize;
      blurred[idx + 3] = aSum / kernelSize;
    }
  }

  // Apply unsharp mask: original + amount * (original - blurred)
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const origR = pixels[idx];
    const origG = pixels[idx + 1];
    const origB = pixels[idx + 2];
    const origA = pixels[idx + 3];

    const blurR = blurred[idx];
    const blurG = blurred[idx + 1];
    const blurB = blurred[idx + 2];
    const blurA = blurred[idx + 3];

    // Calculate difference
    const diffR = origR - blurR;
    const diffG = origG - blurG;
    const diffB = origB - blurB;

    // Apply threshold
    const magnitude = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
    if (magnitude <= threshold) {
      continue;
    }

    // Apply sharpening
    pixels[idx] = Math.min(255, Math.max(0, origR + diffR * amount));
    pixels[idx + 1] = Math.min(255, Math.max(0, origG + diffG * amount));
    pixels[idx + 2] = Math.min(255, Math.max(0, origB + diffB * amount));
  }

  // Put the sharpened image back
  ctx.putImageData(imageData, 0, 0);
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  // Parse and validate options
  const opts: FilterOptions = {
    brightness: Math.max(-100, Math.min(100, Number(o.brightness ?? 0) || 0)),
    contrast: Math.max(-100, Math.min(100, Number(o.contrast ?? 0) || 0)),
    saturation: Math.max(0, Number(o.saturation ?? 100) || 100),
    grayscale: Boolean(o.grayscale),
    sepia: Boolean(o.sepia),
    sharpen: (['none', 'light', 'medium', 'strong'] as SharpenLevel[]).includes(o.sharpen as SharpenLevel)
      ? (o.sharpen as SharpenLevel)
      : 'none',
    format: String(o.format ?? 'original'),
    quality: Math.max(10, Math.min(100, Number(o.quality ?? 90) || 90)),
  };
  // Build CSS filter string
  const cssFilter = buildFilterString(opts);
  const hasCssFilters = cssFilter.length > 0;
  const hasSharpen = opts.sharpen !== 'none';

  if (!hasCssFilters && !hasSharpen) {
    // No filters to apply - just convert format if needed
    const outputs = await runBatch(input.files, input, 'Converting', async (file) => {
      const bitmap = await decodeOriented(file);
      const outMime = outputMime(opts.format, file.type);
      const quality = opts.format === 'jpeg' ? opts.quality / 100 : undefined;
      const canvas = createCanvas(bitmap.width, bitmap.height, 'output');
      const ctx = context2d(canvas);
      ctx.drawImage(bitmap, 0, 0);
      if (outMime === 'image/jpeg') {
        flattenForJpeg(ctx, outMime, bitmap.width, bitmap.height);
      }
      const blob = await encodeCanvas(canvas, outMime, quality);
      const outName = `${stem(file.name)}.${extension(outMime)}`;
      return { filename: outName, blob };
    });

    return {
      outputs,
      stats: {
        files: outputs.length,
        originalBytes: input.files.reduce((sum, f) => sum + f.size, 0),
        outputBytes: outputs.reduce((sum, o) => sum + o.blob.size, 0),
        savedBytes: 0,
      },
    };
  }

  let originalBytes = 0;
  let outputBytes = 0;

  const outputs = await runBatch(input.files, input, 'Filtering', async (file) => {
    originalBytes += file.size;

    const bitmap = await decodeOriented(file);
    assertCanvasBudget(bitmap.width, bitmap.height, 'source');

    const outMime = outputMime(opts.format, file.type);
    const quality = opts.format === 'jpeg' ? opts.quality / 100 : undefined;

    // Create output canvas
    const canvas = createCanvas(bitmap.width, bitmap.height, 'output');
    const ctx = context2d(canvas);

    // Apply CSS filters if any
    if (hasCssFilters) {
      ctx.filter = cssFilter;
    }

    // Apply sharpening or just draw
    await applySharpen(ctx, bitmap, bitmap.width, bitmap.height, opts.sharpen);

    // Handle JPEG alpha flattening
    if (outMime === 'image/jpeg') {
      flattenForJpeg(ctx, outMime, bitmap.width, bitmap.height);
    }

    const blob = await encodeCanvas(canvas, outMime, quality);
    outputBytes += blob.size;

    const outName = `${stem(file.name)}.${extension(outMime)}`;
    return { filename: outName, blob };
  });

  return {
    outputs,
    stats: {
      files: outputs.length,
      originalBytes,
      outputBytes,
      savedBytes: originalBytes - outputBytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;