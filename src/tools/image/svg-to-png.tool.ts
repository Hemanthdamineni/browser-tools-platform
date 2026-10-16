import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor } from '@/lib/image';
import { checkAbort } from './common';
import { meta } from './svg-to-png.meta';

const MAX_DIMENSION = 16384;

/**
 * Read the intrinsic size of an SVG from its `width`/`height` attributes, falling
 * back to the `viewBox`. Throws a friendly `ToolError` when neither is usable.
 */
export function intrinsicSize(text: string): { w: number; h: number } {
  if (!/<svg\b/i.test(text)) throw new ToolError('The file is not an SVG document.');
  const root = /<svg\b([^>]*)>/i.exec(text)?.[1] ?? '';
  const read = (key: string) => {
    const match = new RegExp(`\\b${key}\\s*=\\s*["']([0-9.]+)(?:px)?["']`, 'i').exec(root);
    return match ? Number(match[1]) : 0;
  };
  let w = read('width');
  let h = read('height');
  if (!w || !h) {
    const viewBox = /\bviewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(
      root,
    );
    if (viewBox) {
      w = w || Number(viewBox[1]);
      h = h || Number(viewBox[2]);
    }
  }
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) {
    throw new ToolError(
      'Could not determine the SVG dimensions.',
      'Add width and height attributes or a viewBox.',
    );
  }
  return { w, h };
}

/**
 * Decide the final raster size. A width or height override is treated as an
 * absolute pixel size (the other side follows the aspect ratio); otherwise the
 * intrinsic size is multiplied by `scale`.
 */
export function outputSize(
  baseW: number,
  baseH: number,
  options: { scale?: unknown; width?: unknown; height?: unknown },
): { w: number; h: number } {
  const scale =
    Number.isFinite(Number(options.scale)) && Number(options.scale) > 0 ? Number(options.scale) : 1;
  const width =
    Number.isFinite(Number(options.width)) && Number(options.width) > 0 ? Number(options.width) : 0;
  const height =
    Number.isFinite(Number(options.height)) && Number(options.height) > 0
      ? Number(options.height)
      : 0;
  if (width && height) return { w: Math.round(width), h: Math.round(height) };
  if (width) return { w: Math.round(width), h: Math.max(1, Math.round((width * baseH) / baseW)) };
  if (height)
    return { w: Math.max(1, Math.round((height * baseW) / baseH)), h: Math.round(height) };
  return { w: Math.max(1, Math.round(baseW * scale)), h: Math.max(1, Math.round(baseH * scale)) };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  if (input.files.length !== 1) throw new ToolError('Choose one SVG file.');
  const file = input.files[0]!;
  checkAbort(input.signal);
  input.onProgress?.(0, 'Reading SVG');

  const text = await file.text();
  const o = resolveOptions(meta, input.options);
  const base = intrinsicSize(text);
  const { w, h } = outputSize(base.w, base.h, { scale: o.scale, width: o.width, height: o.height });
  if (w < 1 || h < 1 || w > MAX_DIMENSION || h > MAX_DIMENSION) {
    throw new ToolError(
      'The requested output size is out of range.',
      'Reduce the scale or the width/height override.',
    );
  }
  if (typeof createImageBitmap !== 'function') {
    throw new ToolError(
      'Your browser cannot rasterize SVG files.',
      'Try a recent Chrome, Edge, Firefox or Safari.',
    );
  }

  let bitmap: ImageBitmap | null = null;
  try {
    try {
      bitmap = await createImageBitmap(new Blob([text], { type: 'image/svg+xml' }));
    } catch {
      throw new ToolError(
        'The SVG could not be rasterized.',
        'Check that the SVG is well-formed and self-contained.',
      );
    }
    checkAbort(input.signal);

    const canvas = canvasFor(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');
    const background = String(o.background);
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    if (blob.type !== 'image/png') throw new ToolError('This browser could not encode a PNG.');
    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: `${file.name.replace(/\.svg$/i, '') || 'image'}.png`, blob }],
      stats: { width: canvas.width, height: canvas.height },
    };
  } finally {
    bitmap?.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
