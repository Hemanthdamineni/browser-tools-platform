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
import { meta } from './image-resize.meta';

export function computeTargetSize(srcW: number, srcH: number, opts: Record<string, unknown>) {
  if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
    throw new ToolError('Source dimensions must be positive finite numbers.');
  }
  const mode = String(opts.mode ?? 'percent');
  const finite = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const width = Math.max(1, Math.round(finite(opts.width, 800)));
  const height = Math.max(1, Math.round(finite(opts.height, 600)));
  const percent = Math.max(1, finite(opts.percent, 50)) / 100;
  const upscale = Boolean(opts.upscale);
  let w = srcW,
    h = srcH;
  if (mode === 'percent') {
    w = Math.round(srcW * percent);
    h = Math.round(srcH * percent);
  } else if (mode === 'exact') {
    w = width;
    h = height;
  } else if (mode === 'fill') {
    const s = Math.max(width / srcW, height / srcH);
    w = Math.round(srcW * s);
    h = Math.round(srcH * s);
  } else if (mode === 'max-width') {
    const s = width / srcW;
    if (s < 1 || upscale) {
      w = Math.round(srcW * s);
      h = Math.round(srcH * s);
    }
  } else if (mode === 'max-height') {
    const s = height / srcH;
    if (s < 1 || upscale) {
      w = Math.round(srcW * s);
      h = Math.round(srcH * s);
    }
  } else {
    const s = Math.min(width / srcW, height / srcH, upscale ? Infinity : 1);
    w = Math.round(srcW * s);
    h = Math.round(srcH * s);
  }
  if (!upscale && mode !== 'exact' && mode !== 'percent') {
    const s = Math.min(1, srcW / w, srcH / h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  return { w: Math.max(1, Math.round(w) || 1), h: Math.max(1, Math.round(h) || 1) };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const mode = String(o.mode);
  let originalBytes = 0;
  let outputBytes = 0;

  const outputs = await runBatch(input.files, input, 'Resizing', async (file) => {
    originalBytes += file.size;
    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
      const size = computeTargetSize(bitmap.width, bitmap.height, o);
      const mime = outputMime(o.format === 'original' ? 'original' : o.format, file.type);
      const canvas = createCanvas(size.w, size.h);
      const ctx = context2d(canvas);
      flattenForJpeg(ctx, mime, size.w, size.h);
      if (mode === 'fill') {
        const s = Math.max(size.w / bitmap.width, size.h / bitmap.height);
        const sw = size.w / s;
        const sh = size.h / s;
        ctx.drawImage(
          bitmap,
          (bitmap.width - sw) / 2,
          (bitmap.height - sh) / 2,
          sw,
          sh,
          0,
          0,
          size.w,
          size.h,
        );
      } else {
        ctx.drawImage(bitmap, 0, 0, size.w, size.h);
      }
      const blob = await encodeCanvas(canvas, mime, Number(o.quality) / 100);
      outputBytes += blob.size;
      return { filename: `${stem(file.name)}-${size.w}x${size.h}.${extension(mime)}`, blob };
    } finally {
      bitmap.close();
    }
  });

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
