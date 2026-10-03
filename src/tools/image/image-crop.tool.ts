import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles, outputMime, extension, stem } from './common';
import { meta } from './image-crop.meta';
export function cropRect(srcW: number, srcH: number, opts: Record<string, unknown>) {
  if (opts.mode === 'pixels') {
    const x = Math.max(0, Math.floor(Number(opts.x) || 0)),
      y = Math.max(0, Math.floor(Number(opts.y) || 0)),
      w = Math.min(srcW - x, Math.floor(Number(opts.cropWidth) || 0)),
      h = Math.min(srcH - y, Math.floor(Number(opts.cropHeight) || 0));
    if (x >= srcW || y >= srcH || w <= 0 || h <= 0)
      throw new ToolError('The crop rectangle is outside the image or has zero size.');
    return { x, y, w, h };
  }
  const parts = String(opts.aspect ?? '1:1')
    .split(':')
    .map(Number);
  if (parts.length !== 2 || parts.some((v) => !Number.isFinite(v) || v <= 0))
    throw new ToolError('Enter a valid aspect ratio, such as 16:9.');
  const ratio = parts[0]! / parts[1]!;
  let w = srcW,
    h = srcH;
  if (w / h > ratio) w = Math.round(h * ratio);
  else h = Math.round(w / ratio);
  const a = String(opts.anchor ?? 'center');
  const x = a.includes('left') ? 0 : a.includes('right') ? srcW - w : Math.round((srcW - w) / 2);
  const y = a.includes('top') ? 0 : a.includes('bottom') ? srcH - h : Math.round((srcH - h) / 2);
  return { x, y, w, h };
}
async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files);
  const f = input.files[0]!;
  checkAbort(input.signal);
  input.onProgress?.(0, 'Cropping image');
  const b = await decodeImage(f);
  try {
    const r = cropRect(b.width, b.height, o),
      mime = outputMime(o.format, f.type),
      c = canvasFor(r.w, r.h),
      ctx = c.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');
    ctx.drawImage(b, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const blob = await c.convertToBlob({ type: mime });
    if (blob.type !== mime) throw new ToolError(`This browser cannot encode ${mime}.`);
    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: `${stem(f.name)}-crop.${extension(mime)}`, blob }],
      stats: { x: r.x, y: r.y, width: r.w, height: r.h },
    };
  } finally {
    b.close();
  }
}
const tool: FileToolModule = { meta, run };
export default tool;
