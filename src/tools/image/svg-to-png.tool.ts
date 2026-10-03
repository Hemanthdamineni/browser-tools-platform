import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor } from '@/lib/image';
import { checkAbort } from './common';
import { meta } from './svg-to-png.meta';
export function intrinsicSize(text: string): { w: number; h: number } {
  if (!/<svg\b/i.test(text)) throw new ToolError('The file is not an SVG document.');
  const root = /<svg\b([^>]*)>/i.exec(text)?.[1] ?? '';
  const read = (key: string) => {
    const m = new RegExp(`\\b${key}\\s*=\\s*["']([0-9.]+)(?:px)?["']`, 'i').exec(root);
    return m ? Number(m[1]) : 0;
  };
  let w = read('width'),
    h = read('height');
  if (!w || !h) {
    const vb = /\bviewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(root);
    if (vb) {
      w = w || Number(vb[1]);
      h = h || Number(vb[2]);
    }
  }
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h))
    throw new ToolError(
      'Could not determine the SVG dimensions.',
      'Add width and height attributes or a viewBox.',
    );
  return { w, h };
}
async function run(input: FileRunInput): Promise<FileRunResult> {
  if (input.files.length !== 1) throw new ToolError('Choose one SVG file.');
  const f = input.files[0]!;
  checkAbort(input.signal);
  input.onProgress?.(0, 'Reading SVG');
  const text = await f.text();
  const o = resolveOptions(meta, input.options);
  const base = intrinsicSize(text);
  const w = Number(o.width) > 0 ? Number(o.width) : base.w,
    h = Number(o.height) > 0 ? Number(o.height) : base.h,
    scale = Number(o.scale);
  const bitmap = await createImageBitmap(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const c = canvasFor(w * scale, h * scale),
      ctx = c.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');
    if (o.background !== 'transparent') {
      ctx.fillStyle = String(o.background);
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    const blob = await c.convertToBlob({ type: 'image/png' });
    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: `${f.name.replace(/\.svg$/i, '')}.png`, blob }],
      stats: { width: c.width, height: c.height },
    };
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError('This browser could not rasterize the SVG.');
  } finally {
    bitmap.close();
  }
}
const tool: FileToolModule = { meta, run };
export default tool;
