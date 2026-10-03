import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-fade.meta';
import { decodeFile, toWavBlob } from './lib';

/** Calculate a 0..1 envelope position with a selected shape. */
export function fadeEnvelope(position: number, curve: string): number {
  const t = Math.max(0, Math.min(1, position));
  switch (curve) {
    case 'exponential': return t * t;
    case 'logarithmic': return Math.sqrt(t);
    default: return t;
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  const fadeInMs = Math.max(0, Number(o.fadeInMs ?? 1000));
  const fadeOutMs = Math.max(0, Number(o.fadeOutMs ?? 1000));
  if (!Number.isFinite(fadeInMs) || !Number.isFinite(fadeOutMs)) throw new ToolError('Enter valid fade durations.');
  const curve = String(o.curve ?? 'linear');

  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(input.files[0]!);
  input.signal?.throwIfAborted?.();
  const length = audio.channels[0]?.length ?? 0;
  const inFrames = Math.min(length, Math.round(fadeInMs * audio.sampleRate / 1000));
  const outFrames = Math.min(length, Math.round(fadeOutMs * audio.sampleRate / 1000));

  const channels = audio.channels.map((source) => {
    const ch = source.slice(0);
    for (let i = 0; i < length; i++) {
      let gain = 1;
      if (inFrames > 0 && i < inFrames) gain = Math.min(gain, fadeEnvelope(i / inFrames, curve));
      if (outFrames > 0 && i >= length - outFrames) {
        gain = Math.min(gain, fadeEnvelope((length - 1 - i) / outFrames, curve));
      }
      ch[i] = ch[i]! * gain;
    }
    return ch;
  });

  input.onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: `${input.files[0]!.name.replace(/\.[^.]*$/, '') || 'audio'}-faded.wav`, blob: toWavBlob(channels, audio.sampleRate) }],
    stats: { fadeInMs: Math.round(inFrames * 1000 / audio.sampleRate), fadeOutMs: Math.round(outFrames * 1000 / audio.sampleRate), curve },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
