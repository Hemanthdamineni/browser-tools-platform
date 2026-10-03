import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles, outputMime, extension, stem } from './common';
import { meta } from './image-rotate.meta';
export function outputSize(w: number, h: number, rotate: unknown) {
  return rotate === '90' || rotate === 90 || rotate === '270' || rotate === 270
    ? { w: h, h: w }
    : { w, h };
}
async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  const outputs = [];
  for (let i = 0; i < input.files.length; i++) {
    checkAbort(input.signal);
    const f = input.files[i]!;
    input.onProgress?.(i / input.files.length, `Rotating ${f.name}`);
    const b = await decodeImage(f);
    try {
      const rotate = Number(o.rotate),
        size = outputSize(b.width, b.height, rotate),
        mime = outputMime(o.format, f.type),
        c = canvasFor(size.w, size.h),
        ctx = c.getContext('2d');
      if (!ctx) throw new ToolError('Could not create a drawing context.');
      ctx.translate(size.w / 2, size.h / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      const flip = String(o.flip);
      ctx.scale(
        flip === 'horizontal' || flip === 'both' ? -1 : 1,
        flip === 'vertical' || flip === 'both' ? -1 : 1,
      );
      ctx.drawImage(b, -b.width / 2, -b.height / 2);
      const blob = await c.convertToBlob({ type: mime });
      if (blob.type !== mime) throw new ToolError(`This browser cannot encode ${mime}.`);
      outputs.push({ filename: `${stem(f.name)}-rotated.${extension(mime)}`, blob });
    } finally {
      b.close();
    }
  }
  input.onProgress?.(1, 'Done');
  return { outputs, stats: { files: outputs.length } };
}
const tool: FileToolModule = { meta, run };
export default tool;
