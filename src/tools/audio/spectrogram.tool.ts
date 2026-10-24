/**
 * The spectrogram tool.
 *
 * The panel owns the browser APIs — the file picker, the drop zone, the
 * microphone and the canvas preview — and hands the chosen audio file to this
 * module as a `File`. This module decodes it, mixes to mono, computes the
 * magnitude spectrogram with the panel's pure DSP (the same code the live view
 * uses) and returns the PNG as a downloadable file.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  analyseSpectrogramFile,
  resolveColourMap,
  resolveSpectrogramOptions,
} from '@/components/panels/spectrogram-panel';
import { meta } from './spectrogram.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) {
    throw new ToolError('Choose an audio file to analyse.');
  }
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0, 'Decoding');
  const spec = resolveSpectrogramOptions(o);
  const colourMap = resolveColourMap(o.colourMap);
  const result = await analyseSpectrogramFile(input.files[0]!, spec, colourMap);
  input.signal?.throwIfAborted?.();
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
