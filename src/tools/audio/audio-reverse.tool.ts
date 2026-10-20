import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './audio-reverse.meta';
import { decodeFile, toWavBlob } from './lib';

export function reverseChannel(channel: Float32Array): Float32Array {
  const out = channel.slice(0);
  out.reverse();
  return out;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(input.files[0]!);
  input.signal?.throwIfAborted?.();
  const channels = audio.channels.map(reverseChannel);
  input.onProgress?.(1, 'Done');
  return {
    outputs: [
      {
        filename: `${input.files[0]!.name.replace(/\.[^.]*$/, '') || 'audio'}-reversed.wav`,
        blob: toWavBlob(channels, audio.sampleRate),
      },
    ],
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
