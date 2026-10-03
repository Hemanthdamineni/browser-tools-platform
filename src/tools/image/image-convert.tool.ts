import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles, extension, stem, parseHexColor } from './common';
import { meta } from './image-convert.meta';

export function imageOutputType(mime: string): string {
  return mime;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  const to = String(o.to);
  const targetMime = `image/${to}`;
  const outputs = [];
  let originalBytes = 0,
    outputBytes = 0;
  for (let i = 0; i < input.files.length; i++) {
    checkAbort(input.signal);
    const f = input.files[i]!;
    originalBytes += f.size;
    input.onProgress?.(i / input.files.length, `Converting ${f.name}`);
    const b = await decodeImage(f);
    try {
      const c = canvasFor(b.width, b.height),
        ctx = c.getContext('2d');
      if (!ctx) throw new ToolError('Could not create a drawing context.');
      if (targetMime === 'image/jpeg') {
        const rgb = parseHexColor(String(o.background)) ?? [255, 255, 255];
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(0, 0, b.width, b.height);
      }
      ctx.drawImage(b, 0, 0);
      const blob = await c.convertToBlob({ type: targetMime, quality: Number(o.quality) / 100 });
      if (blob.type !== targetMime)
        throw new ToolError(`This browser cannot encode ${to}.`, 'Try WebP or PNG.');
      outputs.push({ filename: `${stem(f.name)}.${extension(targetMime)}`, blob });
      outputBytes += blob.size;
    } finally {
      b.close();
    }
  }
  input.onProgress?.(1, 'Done');
  return {
    outputs,
    stats: { files: outputs.length, originalBytes, outputBytes, format: targetMime },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;
