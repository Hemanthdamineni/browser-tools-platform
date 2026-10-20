import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-channels.meta';
import { decodeFile, remixChannels, toWavBlob } from './lib';

export function transformChannels(channels: Float32Array[], operation: string): Float32Array[] {
  const stereo = remixChannels(channels, 2);
  const left = stereo[0]!;
  const right = stereo[1]!;
  switch (operation) {
    case 'to-mono':
      return [remixChannels(channels, 1)[0]!];
    case 'to-stereo':
      return stereo;
    case 'swap':
      return [right, left];
    case 'left-only':
      return [left, left.slice(0)];
    case 'right-only':
      return [right, right.slice(0)];
    case 'mid-side': {
      const mid = new Float32Array(left.length);
      const side = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        mid[i] = (left[i]! + right[i]!) / 2;
        side[i] = (left[i]! - right[i]!) / 2;
      }
      return [mid, side];
    }
    default:
      return stereo;
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  const operation = String(o.operation ?? 'to-mono');
  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(input.files[0]!);
  input.signal?.throwIfAborted?.();
  const channels = transformChannels(audio.channels, operation);
  input.onProgress?.(1, 'Done');
  return {
    outputs: [
      {
        filename: `${input.files[0]!.name.replace(/\.[^.]*$/, '') || 'audio'}-${operation}.wav`,
        blob: toWavBlob(channels, audio.sampleRate),
      },
    ],
    stats: { operation, channels: channels.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
