import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles, outputMime, extension, stem } from './common';
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
  const percent = Math.max(1, Math.min(400, finite(opts.percent, 50))) / 100;
  const upscale = Boolean(opts.upscale);
  let w = srcW, h = srcH;
  if (mode === 'percent') { w = Math.round(srcW * percent); h = Math.round(srcH * percent); }
  else if (mode === 'exact') { w = width; h = height; }
  else if (mode === 'fill') { const s = Math.max(width / srcW, height / srcH); w = Math.round(srcW * s); h = Math.round(srcH * s); }
  else if (mode === 'max-width') { const s = width / srcW; if (s < 1 || upscale) { w = Math.round(srcW * s); h = Math.round(srcH * s); } }
  else if (mode === 'max-height') { const s = height / srcH; if (s < 1 || upscale) { w = Math.round(srcW * s); h = Math.round(srcH * s); } }
  else { const s = Math.min(width / srcW, height / srcH, upscale ? Infinity : 1); w = Math.round(srcW * s); h = Math.round(srcH * s); }
  if (!upscale && mode !== 'exact' && mode !== 'percent') { const s = Math.min(1, srcW / w, srcH / h); w = Math.round(w * s); h = Math.round(h * s); }
  return { w: Math.max(1, Math.round(w) || 1), h: Math.max(1, Math.round(h) || 1) };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  const outputs = []; let originalBytes = 0; let outputBytes = 0;
  for (let i = 0; i < input.files.length; i++) {
    checkAbort(input.signal); const file = input.files[i]!; originalBytes += file.size;
    input.onProgress?.(i / input.files.length, `Resizing ${file.name}`);
    const bitmap = await decodeImage(file);
    try {
      const size = computeTargetSize(bitmap.width, bitmap.height, o);
      const mime = outputMime(o.format === 'original' ? 'original' : o.format, file.type);
      const canvas = canvasFor(size.w, size.h); const ctx = canvas.getContext('2d');
      if (!ctx) throw new ToolError('Could not create a drawing context.');
      if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.w, size.h); }
      const mode = String(o.mode);
      if (mode === 'fill') { const s = Math.max(size.w / bitmap.width, size.h / bitmap.height); const sw = size.w / s, sh = size.h / s; ctx.drawImage(bitmap, (bitmap.width-sw)/2, (bitmap.height-sh)/2, sw, sh, 0, 0, size.w, size.h); }
      else ctx.drawImage(bitmap, 0, 0, size.w, size.h);
      const blob = await canvas.convertToBlob({ type: mime, quality: Number(o.quality) / 100 });
      if (blob.type !== mime) throw new ToolError(`This browser cannot encode ${mime}.`);
      outputs.push({ filename: `${stem(file.name)}-${size.w}x${size.h}.${extension(mime)}`, blob }); outputBytes += blob.size;
    } finally { bitmap.close(); }
  }
  input.onProgress?.(1, 'Done');
  return { outputs, stats: { files: outputs.length, originalBytes, outputBytes, savedPercent: originalBytes ? Math.round((1-outputBytes/originalBytes)*1000)/10 : 0 } };
}
const tool: FileToolModule = { meta, run }; export default tool;
