import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './voice-recorder.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) {
    throw new ToolError('Record a clip first.');
  }
  const file = input.files[0]!;
  if (!file.size) {
    throw new ToolError('The recording is empty — there is nothing to save.');
  }
  const format = String(o.format ?? 'wav');
  const filename = String(o.filename ?? 'voice-recording');
  let ext = 'wav';
  let mime = 'audio/wav';
  if (format === 'webm') {
    ext = 'webm';
    mime = 'audio/webm';
  }
  const outputName = `${filename}.${ext}`;

  return {
    outputs: [{ filename: outputName, blob: file }],
    notes: [
      format === 'wav'
        ? 'Recorded as WAV (lossless, 16-bit). '
        : 'Recorded as WebM (compressed Opus). ',
    ],
    stats: { format, sizeBytes: file.size },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
