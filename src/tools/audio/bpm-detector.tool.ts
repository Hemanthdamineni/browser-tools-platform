/**
 * The BPM detector tool.
 *
 * The panel owns the browser APIs — the file picker, the microphone and the
 * tap button. It hands the chosen audio file to this module as a `File`; the
 * module decodes it and runs the onset/autocorrelation tempo detector. The
 * detector maths itself lives in `bpm-detector-panel.ts` so the panel and the
 * report share exactly the same numbers.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { analyzeFile, readTempoOptions } from '@/components/panels/bpm-detector-panel';
import { meta } from './bpm-detector.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) {
    throw new ToolError('Choose an audio file to measure.');
  }
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0, 'Decoding');
  const options = readTempoOptions(o);
  const result = await analyzeFile(input.files[0]!, options);
  input.signal?.throwIfAborted?.();
  input.onProgress?.(1, 'Done');
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
