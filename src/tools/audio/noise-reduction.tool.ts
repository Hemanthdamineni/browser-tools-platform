import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './noise-reduction.meta';
import { reduceNoiseFile, NoiseReductionOptions } from './noise-reduction.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one audio file.');

  const options: NoiseReductionOptions = {
    mix: Number(o.mix ?? 100),
    vadThreshold: Number(o.vadThreshold ?? 0.5),
  };

  const outputs: Array<{ filename: string; blob: Blob }> = [];

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onProgress?.(i / files.length, `Processing ${files[i]!.name}`);

    const file = files[i]!;
    const blob = await reduceNoiseFile(file, options);
    const stem = file.name.replace(/\.[^.]+$/, '');
    outputs.push({
      filename: `${stem}-denoised.wav`,
      blob,
    });
  }

  onProgress?.(1, 'Done');
  return {
    outputs,
    notes: [
      `Applied RNNoise neural network noise suppression`,
      `Mix: ${options.mix}%, VAD threshold: ${options.vadThreshold}`,
    ],
    stats: { files: outputs.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;