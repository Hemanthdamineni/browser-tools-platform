import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mic-test.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) {
    throw new ToolError('Record a clip first.');
  }
  const file = input.files[0]!;
  if (!file.size) {
    throw new ToolError('The recording is empty — there is nothing to save.');
  }
  const container = file.type.includes('webm') ? 'webm' : 'wav';
  const filename = String(o.filename ?? 'mic-recording');
  let ext = 'wav';
  let mime = 'audio/wav';
  if (container === 'webm') {
    ext = 'webm';
    mime = 'audio/webm';
  }
  const outputName = `${filename}.${ext}`;

  return {
    outputs: [{ filename: outputName, blob: file }],
    notes: [
      container === 'webm'
        ? 'Recorded as WebM (compressed Opus).'
        : 'Recorded as WAV (lossless, 16-bit).',
    ],
    stats: { format: container, sizeBytes: file.size },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
