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
import { meta } from './image-crop.meta';

export function cropRect(srcW: number, srcH: number, opts: Record<string, unknown>) {
  if (opts.mode === 'pixels') {
    const x = Math.max(0, Math.floor(Number(opts.x) || 0));
    const y = Math.max(0, Math.floor(Number(opts.y) || 0));
    const w = Math.min(srcW - x, Math.floor(Number(opts.cropWidth) || 0));
    const h = Math.min(srcH - y, Math.floor(Number(opts.cropHeight) || 0));
    if (x >= srcW || y >= srcH || w <= 0 || h <= 0) {
      throw new ToolError('The crop rectangle is outside the image or has zero size.');
    }
    return { x, y, w, h };
  }
  const parts = String(opts.aspect ?? '1:1').split(':').map(Number);
  if (parts.length !== 2 || parts.some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new ToolError('Enter a valid aspect ratio, such as 16:9.');
  }
  const ratio = parts[0]! / parts[1]!;
  let w = srcW;
  let h = srcH;
  if (w / h > ratio) w = Math.round(h * ratio);
  else h = Math.round(w / ratio);
  const a = String(opts.anchor ?? 'center');
  const x = a.includes('left') ? 0 : a.includes('right') ? srcW - w : Math.round((srcW - w) / 2);
  const y = a.includes('top') ? 0 : a.includes('bottom') ? srcH - h : Math.round((srcH - h) / 2);
  return { x, y, w, h };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const outputs = await runBatch(input.files, input, 'Cropping', async (file) => {
    const bitmap = await decodeOriented(file);
    try {
      assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
      const rect = cropRect(bitmap.width, bitmap.height, o);
      const mime = outputMime(o.format, file.type);
      const canvas = createCanvas(rect.w, rect.h);
      const ctx = context2d(canvas);
      flattenForJpeg(ctx, mime, rect.w, rect.h);
      ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      const blob = await encodeCanvas(canvas, mime);
      return { filename: `${stem(file.name)}-crop.${extension(mime)}`, blob };
    } finally {
      bitmap.close();
    }
  });

  return { outputs, stats: { files: outputs.length } };
}

const tool: FileToolModule = { meta, run };
export default tool;
