import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './image-upscale.meta';
import { upscaleBatch, UpscaleOptions } from './image-upscale.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one image file.');

  const options: UpscaleOptions = {
    scale: Number(o.scale ?? 2) as 2 | 4,
    model: String(o.model ?? 'realesrgan-x2') as UpscaleOptions['model'],
    tileSize: Number(o.tileSize ?? 256),
    outputFormat: String(o.outputFormat ?? 'png') as UpscaleOptions['outputFormat'],
    jpegQuality: Number(o.jpegQuality ?? 90),
  };

  const results = await upscaleBatch(files, options, (fileIndex, totalFiles, fileProgress, message) => {
    const overallProgress = (fileIndex + fileProgress) / totalFiles;
    onProgress?.(overallProgress, `[${fileIndex + 1}/${totalFiles}] ${message}`);
  });

  const outputs = results.map((result, i) => {
    const file = files[i]!;
    const stem = file.name.replace(/\.[^.]+$/, '');
    const ext = options.outputFormat === 'jpeg' ? 'jpg' : options.outputFormat;
    return {
      filename: `${stem}-upscaled${options.scale}x.${ext}`,
      blob: result.blob,
      previewUrl: URL.createObjectURL(result.blob),
    };
  });

  return {
    outputs,
    notes: [
      `Upscaled ${outputs.length} image(s) ${options.scale}x using ${options.model}`,
      `Tile size: ${options.tileSize}px, Output: ${options.outputFormat.toUpperCase()}`,
    ],
    stats: {
      files: outputs.length,
      scale: options.scale,
      model: options.model,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;